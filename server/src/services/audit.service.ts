/**
 * audit.service.ts
 * Append-only audit logging service.
 *
 * AuditLog records are WRITE-ONLY from this service:
 *   - logAuditEvent()  — fire-and-forget write (never throws)
 *   - getAuditLogs()   — paginated read for the admin route
 *
 * There are NO update or delete functions. The admin route exposes
 * only GET /api/admin/audit-logs; no mutating endpoints exist.
 *
 * Supported actions:
 *   incident_created        — new packet ingested from mobile SDK
 *   incident_viewed         — operator opened incident detail
 *   status_changed          — operator updated incident status
 *   operator_note_added     — standalone note added (future)
 *   user_login              — successful login (future JWT)
 *   failed_login            — failed login attempt (future JWT)
 *   dashboard_access_denied — request rejected by requireAdmin middleware
 */

import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

// ─── Action Enum ──────────────────────────────────────────────────────────────

export type AuditAction =
  | 'incident_created'
  | 'incident_viewed'
  | 'status_changed'
  | 'operator_note_added'
  | 'user_login'
  | 'failed_login'
  | 'dashboard_access_denied';

// ─── Write ────────────────────────────────────────────────────────────────────

export interface AuditEventParams {
  action: AuditAction;
  actorUserId?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget audit log write. Never throws.
 * Errors are logged to stderr but do not affect the calling request.
 */
export function logAuditEvent(params: AuditEventParams): void {
  prisma.auditLog
    .create({
      data: {
        actorUserId: params.actorUserId ?? null,
        actorRole:   params.actorRole   ?? null,
        action:      params.action,
        entityType:  params.entityType  ?? null,
        entityId:    params.entityId    ?? null,
        ipAddress:   params.ipAddress   ?? null,
        userAgent:   params.userAgent   ?? null,
        metadata:    params.metadata
          ? (params.metadata as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    })
    .catch((err: unknown) => {
      console.warn(
        '[AUDIT] Write failed (non-critical):',
        err instanceof Error ? err.message : err
      );
    });
}

// ─── Read (admin only) ────────────────────────────────────────────────────────

export interface AuditLogsResult {
  total: number;
  page: number;
  limit: number;
  pages: number;
  logs: {
    id: string;
    actorUserId: string | null;
    actorRole: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }[];
}

export async function getAuditLogs(opts: {
  page: number;
  limit: number;
  action?: string;
  entityId?: string;
  actorUserId?: string;
}): Promise<AuditLogsResult> {
  const skip = (opts.page - 1) * opts.limit;

  const where: Prisma.AuditLogWhereInput = {};
  if (opts.action)      where.action      = opts.action;
  if (opts.entityId)    where.entityId    = opts.entityId;
  if (opts.actorUserId) where.actorUserId = opts.actorUserId;

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: opts.limit,
      select: {
        id:          true,
        actorUserId: true,
        actorRole:   true,
        action:      true,
        entityType:  true,
        entityId:    true,
        ipAddress:   true,
        userAgent:   true,
        metadata:    true,
        createdAt:   true,
      },
    }),
  ]);

  return {
    total,
    page: opts.page,
    limit: opts.limit,
    pages: Math.ceil(total / opts.limit) || 1,
    logs,
  };
}
