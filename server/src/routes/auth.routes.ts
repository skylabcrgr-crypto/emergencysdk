/**
 * auth.routes.ts
 * Authentication endpoints.
 *
 *   POST /api/auth/login            — email + password → { token, user }
 *   GET  /api/auth/me               — current user from Bearer token
 *   POST /api/auth/logout           — audit-only (stateless JWT); client clears token
 *   POST /api/auth/change-password  — authenticated password change
 *   POST /api/auth/forgot-password  — request a reset link (generic response)
 *   POST /api/auth/reset-password   — complete a reset with a token
 *
 * Security posture:
 *   - No user enumeration on login or forgot-password.
 *   - Brute-force lockout after MAX_LOGIN_ATTEMPTS for LOCKOUT_MINUTES.
 *   - Reset tokens are random; only their SHA-256 hash is stored.
 *   - Raw passwords and raw reset tokens are never logged.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { env } from '../config/env';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validation/auth.schema';
import {
  signToken,
  verifyPassword,
  hashPassword,
  generateSecureToken,
  hashToken,
  type UserRole,
} from '../services/auth.service';
import { validatePasswordStrength } from '../services/passwordPolicy.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { requireAuth } from '../middleware/auth.middleware';
import { logAuditEvent } from '../services/audit.service';
import { getClientIp } from '../middleware/requestLogger';
import { sendError, sendZodError } from '../utils/httpError';

export const authRouter = Router();

const GENERIC_LOGIN_FAIL = 'Invalid email or password.';
const GENERIC_LOCKED =
  'Too many failed attempts. Try again later or reset your password.';
const GENERIC_RESET_RESPONSE =
  'If an account exists, password reset instructions have been sent.';

const isDev = env.NODE_ENV === 'development';

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  const { email, password } = parsed.data;
  const ip = getClientIp(req);
  const userAgent = req.header('user-agent') ?? null;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Account locked?
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      logAuditEvent({
        action: 'failed_login',
        actorUserId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { email, reason: 'locked' },
      });
      return sendError(res, 423, 'ACCOUNT_LOCKED', GENERIC_LOCKED);
    }

    const passwordOk =
      user?.isActive === true &&
      typeof user.passwordHash === 'string' &&
      (await verifyPassword(password, user.passwordHash));

    if (!user || !passwordOk) {
      // Increment failure counter only for real, active accounts.
      if (user && user.isActive) {
        const attempts = user.failedLoginAttempts + 1;
        const locked = attempts >= env.MAX_LOGIN_ATTEMPTS;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil: locked
              ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60_000)
              : null,
          },
        });
        if (locked) {
          logAuditEvent({
            action: 'account_locked',
            actorUserId: user.id,
            ipAddress: ip,
            userAgent,
            metadata: { email },
          });
        }
      }

      logAuditEvent({
        action: 'failed_login',
        actorUserId: user?.id ?? null,
        ipAddress: ip,
        userAgent,
        metadata: { email },
      });
      return sendError(res, 401, 'INVALID_CREDENTIALS', GENERIC_LOGIN_FAIL);
    }

    // Success — reset counters, stamp lastLoginAt.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

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
      user: { id: user.id, email: user.email, name: user.name, role },
    });
  } catch (err) {
    console.error('[auth] login error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.');
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user || !user.isActive) {
      return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    });
  } catch {
    return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.');
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// JWT is stateless; this is audit-only. The client discards the token.
// TODO (production): maintain a token blocklist / use short-lived access tokens
//                    with refresh tokens to enable true server-side revocation.

authRouter.post('/logout', requireAuth, (req: Request, res: Response) => {
  logAuditEvent({
    action: 'user_logout',
    actorUserId: req.user?.userId ?? null,
    actorRole: req.user?.role ?? null,
    ipAddress: getClientIp(req),
    userAgent: req.header('user-agent') ?? null,
  });
  return res.json({ success: true });
});

// ─── POST /api/auth/change-password ───────────────────────────────────────────

authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  const { currentPassword, newPassword } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user || !user.isActive || !user.passwordHash) {
      return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return sendError(res, 400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.');
    }

    const policy = validatePasswordStrength(newPassword, user.email?.split('@')[0]);
    if (!policy.valid) {
      return sendError(res, 400, 'WEAK_PASSWORD', policy.errors[0], policy.errors);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    logAuditEvent({
      action: 'password_changed',
      actorUserId: user.id,
      actorRole: user.role,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[auth] change-password error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.');
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
// Always returns the same generic response to avoid user enumeration.

authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  const { email } = parsed.data;
  const ip = getClientIp(req);
  const userAgent = req.header('user-agent') ?? null;
  let devResetUrl: string | null = null;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      const { token, tokenHash } = generateSecureToken();
      const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000);

      // Invalidate prior outstanding tokens, then create the new one.
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const base = env.DASHBOARD_BASE_URL.replace(/\/$/, '');
      const resetUrl = `${base}/reset-password?token=${token}`;

      const { devResetUrl: devUrl } = await sendPasswordResetEmail({ to: email, resetUrl });
      devResetUrl = devUrl;

      logAuditEvent({
        action: 'password_reset_requested',
        actorUserId: user.id,
        ipAddress: ip,
        userAgent,
      });
    } else {
      // Unknown / inactive email — audit internally, do not reveal to client.
      logAuditEvent({
        action: 'password_reset_requested',
        ipAddress: ip,
        userAgent,
        metadata: { unknownEmail: true },
      });
    }

    const body: { message: string; devResetUrl?: string } = { message: GENERIC_RESET_RESPONSE };
    if (isDev && devResetUrl) body.devResetUrl = devResetUrl; // dev-only convenience
    return res.json(body);
  } catch (err) {
    console.error('[auth] forgot-password error:', err instanceof Error ? err.message : err);
    // Still return generic success so failures don't leak existence either.
    return res.json({ message: GENERIC_RESET_RESPONSE });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────

authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  const { token, newPassword } = parsed.data;

  try {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || !record.user.isActive) {
      return sendError(res, 400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or expired. Request a new one.');
    }

    const policy = validatePasswordStrength(newPassword, record.user.email?.split('@')[0]);
    if (!policy.valid) {
      return sendError(res, 400, 'WEAK_PASSWORD', policy.errors[0], policy.errors);
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate any other outstanding tokens for this user.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    logAuditEvent({
      action: 'password_reset_completed',
      actorUserId: record.userId,
      ipAddress: getClientIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[auth] reset-password error:', err instanceof Error ? err.message : err);
    return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.');
  }
});
