/**
 * admin.routes.ts
 * Protected admin API routes.
 *
 * All routes require an authenticated user with the `admin` role
 * (enforced by requireAuth + requireRole('admin') when AUTH_ENABLED=true).
 *
 * Endpoints:
 *   GET /api/admin/audit-logs   — Paginated, filtered audit log viewer
 *
 * IMPORTANT: There are intentionally NO POST / PATCH / DELETE routes
 * for AuditLog. Audit records are immutable and append-only.
 */

import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { getAuditLogs } from '../services/audit.service';
import { auditLogsQuerySchema } from '../validation/admin.schema';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

export const adminRouter = Router();

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────

adminRouter.get(
  '/audit-logs',
  requireAuth,
  requireRole('admin'),
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
