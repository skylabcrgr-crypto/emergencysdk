/**
 * emergency.routes.ts
 * Express router for the Emergency SDK mock API.
 *
 * Endpoints:
 *   POST   /api/emergency/incidents              — Receive packet from mobile SDK
 *   GET    /api/emergency/incidents              — List all incidents (dashboard)
 *   GET    /api/emergency/incidents/:id          — Get single incident
 *   PATCH  /api/emergency/incidents/:id/status   — Update status (dashboard operator)
 *
 * Future integrations:
 * - POST handler: add RapidSOS PULSE forward call here on ingest
 * - PATCH dispatched: trigger CAD API call to create field dispatch record
 * - WebSocket: emit 'incident:updated' event to dashboard on every PATCH
 * - Auth middleware: add Bearer token validation before all routes
 */

import { Router, Request, Response } from 'express';
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  generateIncidentId,
} from '../data/incidents.store';
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

// ─── POST /api/emergency/incidents ───────────────────────────────────────────
// Receives an emergency packet from the mobile SDK.
// This is the URL to set as `apiUrl` in the mobile EmergencyButton.

emergencyRouter.post(
  '/incidents',
  (req: Request, res: Response<CreateIncidentResponse | ErrorResponse>) => {
    const packet = req.body as Partial<IncomingPacket>;

    // Basic validation — ensure critical GPS fields are present
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

    const serverIncidentId = generateIncidentId();
    const now = new Date().toISOString();

    createIncident({
      packetId: packet.id ?? 'unknown',
      serverIncidentId,
      incidentType: packet.incidentType,
      latitude: packet.latitude,
      longitude: packet.longitude,
      accuracy: packet.accuracy ?? 999,
      altitude: packet.altitude ?? null,
      packetTimestamp: packet.timestamp ?? now,
      userId: packet.userId ?? 'anonymous',
      deviceId: packet.deviceId ?? 'unknown',
      appVersion: packet.appVersion ?? '0.0.0',
      batteryLevel: packet.batteryLevel ?? null,
      batteryCharging: packet.batteryCharging ?? null,
      signalStatus: packet.signalStatus ?? 'unknown',
      networkType: packet.networkType ?? 'unknown',
      nearestResource: packet.nearestResource ?? null,
      additionalNotes: packet.additionalNotes ?? '',
      retryCount: packet.retryCount ?? 0,
      status: 'queued',
      receivedAt: now,
      updatedAt: now,
      operatorNotes: '',
      statusHistory: [{ status: 'queued', changedAt: now }],
    });

    console.log(`[ER-API] New incident ${serverIncidentId} — type: ${packet.incidentType}, ` +
      `coords: ${packet.latitude.toFixed(4)}, ${packet.longitude.toFixed(4)}`);

    // Future: POST to RapidSOS PULSE here
    // Future: publish to Redis channel for real-time dashboard push

    return res.status(201).json({
      success: true,
      incidentId: serverIncidentId,
      message: 'Emergency packet received. This is a demo — no real dispatch has occurred.',
      timestamp: now,
    });
  }
);

// ─── GET /api/emergency/incidents ────────────────────────────────────────────
// Returns all incidents sorted by receivedAt descending.
// Supports ?status= filter for dashboard views.

emergencyRouter.get(
  '/incidents',
  (req: Request, res: Response) => {
    let incidents = getAllIncidents();

    // Optional status filter: GET /incidents?status=queued,received
    const statusFilter = req.query.status as string | undefined;
    if (statusFilter) {
      const statuses = statusFilter.split(',') as IncidentStatus[];
      incidents = incidents.filter((i) => statuses.includes(i.status));
    }

    // Optional type filter: GET /incidents?type=medical,boating
    const typeFilter = req.query.type as string | undefined;
    if (typeFilter) {
      const types = typeFilter.split(',');
      incidents = incidents.filter((i) => types.includes(i.incidentType));
    }

    return res.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  }
);

// ─── GET /api/emergency/incidents/:id ────────────────────────────────────────

emergencyRouter.get(
  '/incidents/:id',
  (req: Request, res: Response) => {
    const incident = getIncidentById(req.params.id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: `Incident ${req.params.id} not found`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ success: true, incident });
  }
);

// ─── PATCH /api/emergency/incidents/:id/status ───────────────────────────────
// Dashboard operator updates the incident status.
// Future: trigger CAD dispatch call when status === 'dispatched'.

emergencyRouter.patch(
  '/incidents/:id/status',
  (req: Request, res: Response<UpdateStatusResponse | ErrorResponse>) => {
    const { status, operatorNote } = req.body as UpdateStatusRequest;

    if (!status || !INCIDENT_STATUS_ORDER.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${INCIDENT_STATUS_ORDER.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const updated = updateIncidentStatus(req.params.id, status, operatorNote);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Incident ${req.params.id} not found`,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[ER-API] Incident ${req.params.id} → ${status}${operatorNote ? ` (${operatorNote})` : ''}`);

    // Future: if status === 'dispatched', call CAD API here
    // Future: emit WebSocket event 'incident:updated' to dashboard clients

    return res.json({
      success: true,
      incident: updated,
      message: `Status updated to ${status}`,
    });
  }
);
