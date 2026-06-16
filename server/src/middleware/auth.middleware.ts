/**
 * auth.middleware.ts
 * JWT Bearer authentication & role-based authorization.
 *
 * requireAuth      — validates the Authorization header, attaches req.user.
 * requireRole(...) — ensures req.user.role is one of the allowed roles.
 *
 * Enforcement is gated by env.AUTH_ENABLED:
 *   'false' (default) → tokens are decoded when present (req.user attached),
 *                       but requests are never rejected. Keeps the demo flow
 *                       working while accounts/dashboard login are wired.
 *   'true'            → missing/invalid token → 401, wrong role → 403.
 */

import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { extractBearerToken, verifyToken, type UserRole } from '../services/auth.service';
import { logAuditEvent } from '../services/audit.service';
import { getClientIp } from './requestLogger';

// ─── Express Request augmentation ─────────────────────────────────────────────

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const authEnabled = (): boolean => env.AUTH_ENABLED === 'true';

/**
 * Attach req.user from a valid Bearer token.
 * When AUTH_ENABLED=false, never rejects — just decorates the request.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.header('authorization'));
  const claims = verifyToken(token);

  if (claims) {
    req.user = { userId: claims.sub, role: claims.role };
    return next();
  }

  // No / invalid token.
  if (!authEnabled()) {
    return next(); // permissive mode for the demo
  }

  logAuditEvent({
    action: 'dashboard_access_denied',
    ipAddress: getClientIp(req),
    userAgent: req.header('user-agent') ?? null,
    metadata: { reason: token ? 'invalid_token' : 'missing_token', path: req.path },
  });
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Require the authenticated user to hold one of the allowed roles.
 * Must run after requireAuth. When AUTH_ENABLED=false, never rejects.
 */
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authEnabled()) return next();

    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowed.includes(user.role)) {
      logAuditEvent({
        action: 'dashboard_access_denied',
        actorUserId: user.userId,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        userAgent: req.header('user-agent') ?? null,
        metadata: { reason: 'insufficient_role', required: allowed, path: req.path },
      });
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
