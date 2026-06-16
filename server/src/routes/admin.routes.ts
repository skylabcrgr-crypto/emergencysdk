/**
 * admin.routes.ts
 * Protected admin API routes.
 *
 * All routes require the `x-operator-role: admin` header.
 *
 * TODO (Command 3 — JWT Auth): Replace requireAdmin() with a real
 * JWT verification middleware that extracts role from the token claims.
 *
 * Endpoints:
 *   GET /api/admin/audit-logs   — Paginated, filtered audit log viewer
 *
 * IMPORTANT: There are intentionally NO POST / PATCH / DELETE routes
 * for AuditLog. Audit records are immutable and append-only.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { getAuditLogs, logAuditEvent } from '../services/audit.service';
import { auditLogsQuerySchema } from '../validation/admin.schema';

export const adminRouter = Router();

// ─── Admin role guard ─────────────────────────────────────────────────────────

/**
 * requireAdmin — stub role guard.
 * Rejects requests that do not carry `x-operator-role: admin`.
 * Every rejection writes a `dashboard_access_denied` audit event.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.headers['x-operator-role'];

  if (role !== 'admin') {
    const fwd = req.headers['x-forwarded-for'];
    const ip  = typeof fwd === 'string' ? fwd.split(',')[0].trim() : (req.ip ?? null);

    logAuditEvent({
      action:    'dashboard_access_denied',
      ipAddress: ip,
      userAgent: req.headers['user-agent'] ?? null,
      metadata:  { path: req.path, providedRole: role ?? 'missing' },
    });

    res.status(403).json({
      success:   false,
      error:     'Forbidden. Admin role required. Set header x-operator-role: admin.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────

adminRouter.get(
  '/audit-logs',
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = auditLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const first = (parsed.error as ZodError).issues[0];
      res.status(400).json({
        success:   false,
        error:     `Validation error — ${first?.path.join('.') ?? 'field'}: ${first?.message ?? 'invalid'}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const { page, limit, action, entityId, actorUserId } = parsed.data;

    try {
      const result = await getAuditLogs({ page, limit, action, entityId, actorUserId });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('[ADMIN] GET /audit-logs error:', err);
      res.status(500).json({
        success:   false,
        error:     'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }
);
