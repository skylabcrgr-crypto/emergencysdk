/**
 * auth.routes.ts
 * Authentication endpoints.
 *
 *   POST /api/auth/login  — email + password → { token, user }
 *   GET  /api/auth/me     — current user from Bearer token (requireAuth)
 *
 * Login attempts are audit-logged (user_login / failed_login).
 * To avoid user enumeration, all credential failures return the same 401.
 */

import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import prisma from '../db/prisma';
import { loginSchema } from '../validation/auth.schema';
import { signToken, verifyPassword, type UserRole } from '../services/auth.service';
import { requireAuth } from '../middleware/auth.middleware';
import { logAuditEvent } from '../services/audit.service';
import { getClientIp } from '../middleware/requestLogger';

export const authRouter = Router();

const INVALID_CREDENTIALS = { error: 'Invalid email or password' };

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = (parsed.error as ZodError).issues[0];
    return res.status(400).json({
      error: `Validation error — ${first?.path.join('.') ?? 'field'}: ${first?.message ?? 'invalid'}`,
    });
  }

  const { email, password } = parsed.data;
  const ip = getClientIp(req);
  const userAgent = req.header('user-agent') ?? null;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    const ok =
      user?.isActive === true &&
      typeof user.passwordHash === 'string' &&
      (await verifyPassword(password, user.passwordHash));

    if (!user || !ok) {
      logAuditEvent({
        action: 'failed_login',
        actorUserId: user?.id ?? null,
        ipAddress: ip,
        userAgent,
        metadata: { email },
      });
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    const role = user.role as UserRole;
    const token = signToken(user.id, role);

    logAuditEvent({
      action: 'user_login',
      actorUserId: user.id,
      actorRole: role,
      ipAddress: ip,
      userAgent,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
      },
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch {
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});
