/**
 * emergency.routes.ts
 * Express router for the Emergency SDK API.
 *
 * All handlers are async and delegate to incident.service.ts (Prisma-backed).
 * The in-memory incidents.store.ts is preserved but no longer used here.
 *
 * Endpoints:
 *   POST   /api/emergency/incidents              — Receive packet from mobile SDK
 *   GET    /api/emergency/incidents              — List incidents (dashboard)
 *   GET    /api/emergency/incidents/:id          — Single incident detail
 *   PATCH  /api/emergency/incidents/:id/status   — Operator status update
 *   GET    /api/emergency/health/db              — Database health check
 *
 * Future integrations:
 * - POST handler: add RapidSOS PULSE forward call after createIncident()
 * - PATCH dispatched: trigger CAD API call + push notification
 * - WebSocket: emit 'incident:updated' on every status change
 * - Auth middleware: add requireAuth() before operator routes
 */

import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  addOperatorNote,
  updateIncidentAssignment,
  checkDatabaseHealth,
  ServiceError,
} from '../services/incident.service';
import { logAuditEvent } from '../services/audit.service';
import {
  getResources,
  getNearestResources,
} from '../services/resource.service';
import {
  createIncidentSchema,
  updateStatusSchema,
  incidentQuerySchema,
  noteSchema,
  assignmentSchema,
} from '../validation/incident.schema';
import {
  resourcesQuerySchema,
  nearestResourcesQuerySchema,
} from '../validation/resource.schema';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import type {
  CreateIncidentResponse,
  UpdateStatusResponse,
  ErrorResponse,
} from '../types';

export const emergencyRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serviceErrorToHttp(err: ServiceError): { status: number; message: string } {
  switch (err.code) {
    case 'NOT_FOUND':      return { status: 404, message: err.message };
    case 'VALIDATION':     return { status: 400, message: err.message };
    case 'DB_UNAVAILABLE': return { status: 503, message: 'Database unavailable. Check DATABASE_URL.' };
    default:               return { status: 500, message: err.message };
  }
}

function zodError(err: ZodError): { status: number; message: string } {
  const first = err.issues[0];
  return {
    status:  400,
    message: `Validation error — ${first?.path.join('.') ?? 'field'}: ${first?.message ?? 'invalid'}`,
  };
}

/** Extract the originating IP, respecting Vercel / proxy X-Forwarded-For. */
function getClientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip ?? null;
}

// ─── POST /api/emergency/incidents ───────────────────────────────────────────
// Receives an EmergencyPacket from the mobile SDK.

emergencyRouter.post(
  '/incidents',
  requireAuth,
  async (req: Request, res: Response<CreateIncidentResponse | ErrorResponse>) => {
    const parsed = createIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }

    const packet = parsed.data;

    try {
      const incident = await createIncident(packet);

      process.stdout.write(JSON.stringify({
        ts:         new Date().toISOString(),
        event:      'incident_created',
        incidentId: incident.serverIncidentId,
        type:       incident.incidentType,
        lat:        incident.latitude.toFixed(4),
        lng:        incident.longitude.toFixed(4),
      }) + '\n');

      return res.status(201).json({
        success:    true,
        incidentId: incident.serverIncidentId,
        message:    'Emergency packet received. This is a pre-pilot system — no real dispatch has occurred.',
        timestamp:  new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/incidents ────────────────────────────────────────────

emergencyRouter.get(
  '/incidents',
  requireRole('operator', 'admin', 'viewer'),
  async (req: Request, res: Response) => {
    const parsed = incidentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }
    const { status: statusFilter, type: typeFilter } = parsed.data;

    try {
      const incidents = await getAllIncidents({
        status: statusFilter ? statusFilter.split(',') : undefined,
        type:   typeFilter   ? typeFilter.split(',')   : undefined,
      });
      return res.json({ success: true, count: incidents.length, incidents });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/incidents/:id ────────────────────────────────────────

emergencyRouter.get(
  '/incidents/:id',
  requireRole('operator', 'admin', 'viewer'),
  async (req: Request, res: Response) => {
    try {
      const incident = await getIncidentById(req.params.id);
      if (!incident) {
        return res.status(404).json({
          success:   false,
          error:     `Incident ${req.params.id} not found`,
          timestamp: new Date().toISOString(),
        });
      }

      logAuditEvent({
        action:     'incident_viewed',
        entityType: 'EmergencyIncident',
        entityId:   incident.serverIncidentId,
        ipAddress:  getClientIp(req),
        userAgent:  req.headers['user-agent'] ?? null,
        metadata:   { status: incident.status },
      });

      return res.json({ success: true, incident });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── PATCH /api/emergency/incidents/:id/status ───────────────────────────────

emergencyRouter.patch(
  '/incidents/:id/status',
  requireRole('operator', 'admin'),
  async (req: Request, res: Response<UpdateStatusResponse | ErrorResponse>) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }
    const { status, operatorNote, operatorId } = parsed.data;

    try {
      const updated = await updateIncidentStatus(req.params.id, status, operatorNote, operatorId);
      return res.json({ success: true, incident: updated, message: `Status updated to ${status}` });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status: httpStatus, message } = serviceErrorToHttp(err);
        return res.status(httpStatus).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/health/db ────────────────────────────────────────────

emergencyRouter.get(
  '/health/db',
  async (_req: Request, res: Response) => {
    const result = await checkDatabaseHealth();
    return res.status(result.healthy ? 200 : 503).json({
      ...result,
      timestamp: new Date().toISOString(),
      database: process.env.DATABASE_URL ? 'configured' : 'not configured — set DATABASE_URL',
    });
  }
);

// ─── PATCH /api/emergency/incidents/:id/note ─────────────────────────────────

emergencyRouter.patch(
  '/incidents/:id/note',
  requireRole('operator', 'admin'),
  async (req: Request, res: Response) => {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }
    try {
      const updated = await addOperatorNote(req.params.id, parsed.data.note, parsed.data.operatorId);
      return res.json({ success: true, incident: updated });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── PATCH /api/emergency/incidents/:id/assign ───────────────────────────────

emergencyRouter.patch(
  '/incidents/:id/assign',
  requireRole('operator', 'admin'),
  async (req: Request, res: Response) => {
    const parsed = assignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }
    try {
      const updated = await updateIncidentAssignment(req.params.id, parsed.data);
      return res.json({ success: true, incident: updated });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/resources/nearest ────────────────────────────────────
// NOTE: declared BEFORE '/resources' so the literal path takes priority.

emergencyRouter.get(
  '/resources/nearest',
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = nearestResourcesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }
    const { lat, lng, type, limit } = parsed.data;
    try {
      const resources = await getNearestResources(lat, lng, { type, limit });
      return res.json({ success: true, count: resources.length, resources });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/resources ────────────────────────────────────────────

emergencyRouter.get(
  '/resources',
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = resourcesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const { status, message } = zodError(parsed.error);
      return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
    }
    const { type, county } = parsed.data;
    try {
      const resources = await getResources({ type, county });
      return res.json({ success: true, count: resources.length, resources });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);
