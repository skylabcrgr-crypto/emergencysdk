/**
 * admin.schema.ts
 * Zod schemas for admin/audit-log endpoints.
 *
 * Validates:
 *   auditLogsQuerySchema — GET /api/admin/audit-logs query params
 */

import { z } from 'zod';

export const auditLogsQuerySchema = z.object({
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(200).default(50),
  action:      z.string().max(100).optional(),
  entityId:    z.string().max(200).optional(),
  actorUserId: z.string().max(200).optional(),
});
