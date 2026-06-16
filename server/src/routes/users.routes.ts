/**
 * users.routes.ts
 * Admin user-management API. Mounted at /api/admin/users.
 *
 * All routes require an authenticated admin (requireAuth + requireRole('admin')).
 * passwordHash is NEVER returned. Deletion is implemented as soft-deactivation.
 * The last remaining active admin cannot be demoted/deactivated/removed.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { createUserSchema, updateUserSchema } from '../validation/users.schema';
import {
  hashPassword,
  generateTemporaryPassword,
} from '../services/auth.service';
import { validatePasswordStrength } from '../services/passwordPolicy.service';
import { sendAccountCreatedEmail } from '../services/email.service';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { logAuditEvent } from '../services/audit.service';
import { getClientIp } from '../middleware/requestLogger';
import { sendError, sendZodError } from '../utils/httpError';

export const usersRouter = Router();

// All routes below require an authenticated admin.
usersRouter.use(requireAuth, requireRole('admin'));

const TEMP_PASSWORD_WARNING =
  'Store this temporary password securely. It will not be shown again.';

interface SafeUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Count active admins, optionally excluding one user id. */
async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: { role: 'admin', isActive: true, id: { not: excludeUserId } },
  });
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const users: SafeUser[] = await prisma.user.findMany({
      where: { role: { in: ['admin', 'operator', 'viewer', 'agency_partner'] } },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ users });
  } catch (err) {
    console.error('[users] list error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'DB_UNAVAILABLE', 'User directory unavailable.');
  }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────

usersRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  const { email, name, role, temporaryPassword } = parsed.data;

  // If admin supplied a password, enforce policy; otherwise generate a strong one.
  const tempPassword = temporaryPassword ?? generateTemporaryPassword();
  if (temporaryPassword) {
    const policy = validatePasswordStrength(temporaryPassword, email.split('@')[0]);
    if (!policy.valid) {
      return sendError(res, 400, 'WEAK_PASSWORD', policy.errors[0], policy.errors);
    }
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, 409, 'EMAIL_TAKEN', 'A user with that email already exists.');
    }

    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.user.create({
      data: { email, name: name ?? null, role, passwordHash, isActive: true },
      select: userSelect,
    });

    await sendAccountCreatedEmail({ to: email, name: name ?? null });

    logAuditEvent({
      action: 'admin_user_created',
      actorUserId: req.user?.userId ?? null,
      actorRole: req.user?.role ?? null,
      entityType: 'User',
      entityId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
      metadata: { email, role },
    });

    // Temporary password is returned ONCE for the admin to copy.
    return res.status(201).json({
      user,
      temporaryPassword: tempPassword,
      warning: TEMP_PASSWORD_WARNING,
    });
  } catch (err) {
    console.error('[users] create error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'DB_UNAVAILABLE', 'Could not create user.');
  }
});

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────

usersRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  const { id } = req.params;
  const { name, role, isActive } = parsed.data;

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return sendError(res, 404, 'NOT_FOUND', 'User not found.');

    // Guard: do not allow removing the last active admin via demotion/deactivation.
    const demoting = role !== undefined && role !== 'admin' && target.role === 'admin';
    const deactivating = isActive === false && target.isActive && target.role === 'admin';
    if (demoting || deactivating) {
      const others = await countOtherActiveAdmins(id);
      if (others === 0) {
        return sendError(
          res,
          409,
          'LAST_ADMIN',
          'Cannot demote or deactivate the last remaining admin.',
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: userSelect,
    });

    logAuditEvent({
      action: 'admin_user_updated',
      actorUserId: req.user?.userId ?? null,
      actorRole: req.user?.role ?? null,
      entityType: 'User',
      entityId: id,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
      metadata: { name, role, isActive },
    });

    return res.json({ user });
  } catch (err) {
    console.error('[users] update error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'DB_UNAVAILABLE', 'Could not update user.');
  }
});

// ─── DELETE /api/admin/users/:id  (soft delete → deactivate) ──────────────────

usersRouter.delete('/:id', async (req: Request, res: Response) => {
  await deactivateUser(req, res, req.params.id);
});

usersRouter.post('/:id/deactivate', async (req: Request, res: Response) => {
  await deactivateUser(req, res, req.params.id);
});

async function deactivateUser(req: Request, res: Response, id: string): Promise<void> {
  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      sendError(res, 404, 'NOT_FOUND', 'User not found.');
      return;
    }

    if (target.role === 'admin' && target.isActive) {
      const others = await countOtherActiveAdmins(id);
      if (others === 0) {
        sendError(res, 409, 'LAST_ADMIN', 'Cannot deactivate the last remaining admin.');
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });

    logAuditEvent({
      action: 'admin_user_deactivated',
      actorUserId: req.user?.userId ?? null,
      actorRole: req.user?.role ?? null,
      entityType: 'User',
      entityId: id,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    res.json({ user });
  } catch (err) {
    console.error('[users] deactivate error:', err instanceof Error ? err.message : err);
    sendError(res, 503, 'DB_UNAVAILABLE', 'Could not deactivate user.');
  }
}

// ─── POST /api/admin/users/:id/reactivate ─────────────────────────────────────

usersRouter.post('/:id/reactivate', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return sendError(res, 404, 'NOT_FOUND', 'User not found.');

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: true, failedLoginAttempts: 0, lockedUntil: null },
      select: userSelect,
    });

    logAuditEvent({
      action: 'admin_user_reactivated',
      actorUserId: req.user?.userId ?? null,
      actorRole: req.user?.role ?? null,
      entityType: 'User',
      entityId: id,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return res.json({ user });
  } catch (err) {
    console.error('[users] reactivate error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'DB_UNAVAILABLE', 'Could not reactivate user.');
  }
});

// ─── POST /api/admin/users/:id/reset-password ─────────────────────────────────

usersRouter.post('/:id/reset-password', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return sendError(res, 404, 'NOT_FOUND', 'User not found.');

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    logAuditEvent({
      action: 'admin_password_reset',
      actorUserId: req.user?.userId ?? null,
      actorRole: req.user?.role ?? null,
      entityType: 'User',
      entityId: id,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return res.json({ temporaryPassword: tempPassword, warning: TEMP_PASSWORD_WARNING });
  } catch (err) {
    console.error('[users] admin reset-password error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'DB_UNAVAILABLE', 'Could not reset password.');
  }
});
