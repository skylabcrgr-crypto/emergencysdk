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
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  checkDatabaseHealth,
  ServiceError,
} from '../services/incident.service';
import { logAuditEvent } from '../services/audit.service';
import type {
  IncomingPacket,
  CreateIncidentResponse,
  UpdateStatusRequest,
  UpdateStatusResponse,
  ErrorResponse,
  IncidentStatus,
} from '../types';
import { INCIDENT_STATUS_ORDER } from '../types';

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

/** Extract the originating IP, respecting Vercel / proxy X-Forwarded-For. */
function getClientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip ?? null;
}

// ─── POST /api/emergency/incidents ───────────────────────────────────────────
// Receives an EmergencyPacket from the mobile SDK.
// Set this URL as the `apiUrl` prop in the mobile EmergencyButton.

emergencyRouter.post(
  '/incidents',
  async (req: Request, res: Response<CreateIncidentResponse | ErrorResponse>) => {
    const packet = req.body as Partial<IncomingPacket>;

    if (
      typeof packet.latitude !== 'number' ||
      typeof packet.longitude !== 'number' ||
      !packet.incidentType
    ) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: latitude, longitude, incidentType',
        timestamp: new Date().toISOString(),
      });
    }

    // Sanitize free-text input
    if (packet.additionalNotes) {
      packet.additionalNotes = String(packet.additionalNotes)
        .replace(/<[^>]*>/g, '')
        .slice(0, 500);
    }

    try {
      const incident = await createIncident(packet as IncomingPacket);

      console.log(
        `[ER-API] ${incident.serverIncidentId} created — type: ${incident.incidentType}, ` +
        `coords: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`
      );

      // Future: POST to RapidSOS PULSE here
      // Future: emit WebSocket 'incident:created' event

      return res.status(201).json({
        success: true,
        incidentId: incident.serverIncidentId,
        message: 'Emergency packet received. This is a demo — no real dispatch has occurred.',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status, message } = serviceErrorToHttp(err);
        return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      console.error('[ER-API] POST /incidents error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/incidents ────────────────────────────────────────────
// Returns all incidents sorted newest-first.
// Supports ?status=queued,received and ?type=medical,boating

emergencyRouter.get(
  '/incidents',
  async (req: Request, res: Response) => {
    const statusFilter = req.query.status as string | undefined;
    const typeFilter   = req.query.type   as string | undefined;

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
      console.error('[ER-API] GET /incidents error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/incidents/:id ────────────────────────────────────────

emergencyRouter.get(
  '/incidents/:id',
  async (req: Request, res: Response) => {
    try {
      const incident = await getIncidentById(req.params.id);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: `Incident ${req.params.id} not found`,
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
      console.error('[ER-API] GET /incidents/:id error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── PATCH /api/emergency/incidents/:id/status ───────────────────────────────
// Dashboard operator updates incident status and optionally adds a note.

emergencyRouter.patch(
  '/incidents/:id/status',
  async (req: Request, res: Response<UpdateStatusResponse | ErrorResponse>) => {
    const { status, operatorNote, operatorId } = req.body as UpdateStatusRequest;

    if (!status || !INCIDENT_STATUS_ORDER.includes(status as IncidentStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${INCIDENT_STATUS_ORDER.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const updated = await updateIncidentStatus(
        req.params.id,
        status as IncidentStatus,
        operatorNote,
        operatorId
      );

      console.log(
        `[ER-API] ${req.params.id} → ${status}` +
        (operatorNote ? ` (${operatorNote.slice(0, 60)})` : '')
      );

      // Future: if status === 'dispatched', call CAD API
      // Future: send Expo push notification to victim's device

      return res.json({ success: true, incident: updated, message: `Status updated to ${status}` });
    } catch (err) {
      if (err instanceof ServiceError) {
        const { status: httpStatus, message } = serviceErrorToHttp(err);
        return res.status(httpStatus).json({ success: false, error: message, timestamp: new Date().toISOString() });
      }
      console.error('[ER-API] PATCH /incidents/:id/status error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }
);

// ─── GET /api/emergency/health/db ────────────────────────────────────────────
// Database connectivity check. Returns 200 if healthy, 503 if not.

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
