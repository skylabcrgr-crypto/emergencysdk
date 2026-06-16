/**
 * incident.service.ts
 * Prisma-backed service layer for emergency incidents.
 *
 * All public functions return the existing ServerIncident / IncidentStatus
 * API shapes so the routes and dashboard require zero changes.
 *
 * The in-memory incidents.store.ts is preserved but no longer used by routes.
 *
 * Error handling:
 *   - All functions catch Prisma errors and re-throw as typed ServiceError.
 *   - Routes handle ServiceError and map to HTTP status codes.
 *   - If DATABASE_URL is not set, Prisma will throw PrismaClientInitializationError;
 *     that propagates as a ServiceError with code 'DB_UNAVAILABLE'.
 */

import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { logAuditEvent } from './audit.service';
import type {
  ServerIncident,
  StatusHistoryEntry,
  IncidentStatus,
  NearestResource,
  IncomingPacket,
  NoteRequest,
  AssignmentRequest,
} from '../types';

// ─── Error Type ───────────────────────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'VALIDATION' | 'DB_UNAVAILABLE' | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ─── Prisma Include Shape ─────────────────────────────────────────────────────

const INCIDENT_INCLUDE = {
  nearestResource: true,
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
} satisfies Prisma.EmergencyIncidentInclude;

type IncidentWithRelations = Prisma.EmergencyIncidentGetPayload<{
  include: typeof INCIDENT_INCLUDE;
}>;

// ─── Mapper: Prisma → ServerIncident ─────────────────────────────────────────

function toServerIncident(r: IncidentWithRelations): ServerIncident {
  // Reconstruct NearestResource from snapshot (includes distanceMiles + warning)
  const nearestResource = (r.nearestResourceSnapshot as NearestResource | null) ?? null;

  const statusHistory: StatusHistoryEntry[] = r.statusHistory.map((h) => ({
    fromStatus: (h.fromStatus as IncidentStatus | null) ?? null,
    status: h.toStatus as IncidentStatus,
    changedAt: h.changedAt.toISOString(),
    ...(h.note       ? { operatorNote: h.note }          : {}),
    ...(h.operatorId ? { changedById: h.operatorId }     : {}),
  }));

  return {
    packetId: r.externalPacketId,
    serverIncidentId: r.serverIncidentId,
    incidentType: r.incidentType,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy: r.accuracy,
    altitude: r.altitude ?? null,
    packetTimestamp: r.packetTimestamp?.toISOString() ?? r.receivedAt.toISOString(),
    userId: r.userId ?? 'anonymous',
    deviceId: r.deviceId ?? 'unknown',
    appVersion: r.appVersion ?? '0.0.0',
    batteryLevel: r.batteryLevel ?? null,
    batteryCharging: r.batteryCharging ?? null,
    signalStatus: r.signalStatus,
    networkType: r.networkType,
    nearestResource,
    additionalNotes: r.additionalNotes,
    retryCount: r.retryCount,
    status: r.status as IncidentStatus,
    receivedAt: r.receivedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    operatorNotes: r.operatorNotes,
    statusHistory,
    sourceApp: r.sourceApp,
    staleLocation: r.staleLocation,
    batteryState: r.batteryState,
    assignedOperatorId: r.assignedOperatorId ?? null,
    assignedAgency: r.assignedAgency ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapPrismaError(err: unknown): ServiceError {
  if (err instanceof ServiceError) return err;

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new ServiceError('DB_UNAVAILABLE', 'Database is not reachable. Check DATABASE_URL.');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return new ServiceError('NOT_FOUND', 'Record not found.');
    }
    if (err.code === 'P2002') {
      return new ServiceError('VALIDATION', 'Duplicate incident ID.');
    }
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  return new ServiceError('UNKNOWN', message);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all incidents sorted newest-first.
 * Optionally filters by status and/or incidentType.
 */
export async function getAllIncidents(filters?: {
  status?: string[];
  type?: string[];
}): Promise<ServerIncident[]> {
  try {
    const where: Prisma.EmergencyIncidentWhereInput = {};

    if (filters?.status?.length) {
      where.status = { in: filters.status as IncidentStatus[] };
    }
    if (filters?.type?.length) {
      where.incidentType = { in: filters.type };
    }

    const records = await prisma.emergencyIncident.findMany({
      where,
      include: INCIDENT_INCLUDE,
      orderBy: { receivedAt: 'desc' },
    });

    return records.map(toServerIncident);
  } catch (err) {
    throw wrapPrismaError(err);
  }
}

/**
 * Returns a single incident by its display ID (e.g. "INC-0001").
 * Returns null if not found.
 */
export async function getIncidentById(
  serverIncidentId: string
): Promise<ServerIncident | null> {
  try {
    const record = await prisma.emergencyIncident.findUnique({
      where: { serverIncidentId },
      include: INCIDENT_INCLUDE,
    });

    return record ? toServerIncident(record) : null;
  } catch (err) {
    throw wrapPrismaError(err);
  }
}

/**
 * Persists an incoming EmergencyPacket as a new incident.
 *
 * Steps:
 *   1. If packet.nearestResource is present, upsert it into EmergencyResource.
 *   2. Create the EmergencyIncident (incidentNumber auto-increments).
 *   3. Update serverIncidentId to "INC-XXXX" using incidentNumber.
 *   4. Write the initial 'queued' StatusHistory entry.
 *
 * Returns the full ServerIncident API shape.
 */
export async function createIncident(
  packet: IncomingPacket
): Promise<ServerIncident> {
  try {
    let nearestResourceId: string | undefined;
    const nr = packet.nearestResource;

    // Upsert the nearest resource if provided
    if (nr) {
      await prisma.emergencyResource.upsert({
        where: { id: nr.id },
        create: {
          id: nr.id,
          name: nr.name,
          type: nr.type,
          phone: nr.phone,
          county: nr.county,
          latitude: nr.latitude,
          longitude: nr.longitude,
          address: nr.address,
        },
        update: {
          name: nr.name,
          phone: nr.phone,
          county: nr.county,
        },
      });
      nearestResourceId = nr.id;
    }

    const now = new Date();

    // Create incident + status history in one transaction
    const incident = await prisma.$transaction(async (tx) => {
      const created = await tx.emergencyIncident.create({
        data: {
          externalPacketId: packet.id ?? `pkg-${Date.now()}`,
          serverIncidentId: 'PENDING', // replaced in next step
          userId: packet.userId ?? null,
          deviceId: packet.deviceId ?? null,
          appVersion: packet.appVersion ?? null,
          incidentType: packet.incidentType,
          latitude: packet.latitude,
          longitude: packet.longitude,
          accuracy: packet.accuracy ?? 999,
          altitude: packet.altitude ?? null,
          staleLocation: packet.staleLocation === true,
          batteryLevel: packet.batteryLevel ?? null,
          batteryState:
            packet.batteryState ?? 'unknown',
          batteryCharging: packet.batteryCharging ?? null,
          lowPowerModeEnabled:
            packet.lowPowerModeEnabled ?? null,
          signalStatus: packet.signalStatus ?? 'unknown',
          networkType: packet.networkType ?? 'unknown',
          nearestResourceId: nearestResourceId ?? null,
          nearestResourceDistanceMiles: nr?.distanceMiles ?? null,
          nearestResourceSnapshot: nr ? (nr as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          additionalNotes: packet.additionalNotes ?? '',
          retryCount: packet.retryCount ?? 0,
          status: 'queued',
          packetTimestamp: packet.timestamp ? new Date(packet.timestamp) : now,
          sentAt: packet.sentAt ? new Date(packet.sentAt) : null,
          receivedAt: now,
        },
        include: INCIDENT_INCLUDE,
      });

      // Format the display ID now that incidentNumber is known
      const serverIncidentId = `INC-${String(created.incidentNumber).padStart(4, '0')}`;

      // Write initial status history entry
      await tx.incidentStatusHistory.create({
        data: {
          incidentId: created.id,
          fromStatus: null,
          toStatus: 'queued',
          changedAt: now,
        },
      });

      // Update serverIncidentId in one round-trip
      return tx.emergencyIncident.update({
        where: { id: created.id },
        data: { serverIncidentId },
        include: INCIDENT_INCLUDE,
      });
    });

    // Write audit log (outside transaction — non-critical)
    logAuditEvent({
      action:      'incident_created',
      actorUserId: packet.userId ?? null,
      entityType:  'EmergencyIncident',
      entityId:    incident.serverIncidentId,
      metadata: {
        incidentType: packet.incidentType,
        lat:          packet.latitude,
        lon:          packet.longitude,
      },
    });

    return toServerIncident(incident);
  } catch (err) {
    throw wrapPrismaError(err);
  }
}

/**
 * Updates the status of an incident and appends to status history.
 * Returns the updated ServerIncident, or throws ServiceError NOT_FOUND.
 */
export async function updateIncidentStatus(
  serverIncidentId: string,
  newStatus: IncidentStatus,
  operatorNote?: string,
  operatorId?: string
): Promise<ServerIncident> {
  try {
    const existing = await prisma.emergencyIncident.findUnique({
      where: { serverIncidentId },
      select: { id: true, status: true, operatorNotes: true },
    });

    if (!existing) {
      throw new ServiceError('NOT_FOUND', `Incident ${serverIncidentId} not found`);
    }

    const now = new Date();
    const appendedNotes = operatorNote
      ? `${existing.operatorNotes ? existing.operatorNotes + '\n' : ''}[${now.toLocaleTimeString()}] ${operatorNote}`
      : existing.operatorNotes;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.incidentStatusHistory.create({
        data: {
          incidentId: existing.id,
          fromStatus: existing.status,
          toStatus: newStatus,
          operatorId: operatorId ?? null,
          note: operatorNote ?? null,
          changedAt: now,
        },
      });

      return tx.emergencyIncident.update({
        where: { id: existing.id },
        data: {
          status: newStatus,
          operatorNotes: appendedNotes,
        },
        include: INCIDENT_INCLUDE,
      });
    });

    // Write audit log — captures previousStatus, newStatus, operatorNote, actorUserId
    logAuditEvent({
      action:      'status_changed',
      actorUserId: operatorId ?? null,
      entityType:  'EmergencyIncident',
      entityId:    serverIncidentId,
      metadata: {
        previousStatus: existing.status,
        newStatus,
        operatorNote:   operatorNote ?? null,
        actorUserId:    operatorId   ?? null,
      },
    });

    return toServerIncident(updated);
  } catch (err) {
    throw wrapPrismaError(err);
  }
}

/**
 * Appends a standalone operator note without changing status.
 */
export async function addOperatorNote(
  serverIncidentId: string,
  note: string,
  operatorId?: string
): Promise<ServerIncident> {
  try {
    const existing = await prisma.emergencyIncident.findUnique({
      where: { serverIncidentId },
      select: { id: true, operatorNotes: true },
    });
    if (!existing) throw new ServiceError('NOT_FOUND', `Incident ${serverIncidentId} not found`);

    const now = new Date();
    const appendedNotes =
      `${existing.operatorNotes ? existing.operatorNotes + '\n' : ''}[${now.toLocaleTimeString()}] ${note}`;

    const updated = await prisma.emergencyIncident.update({
      where: { id: existing.id },
      data: { operatorNotes: appendedNotes },
      include: INCIDENT_INCLUDE,
    });

    logAuditEvent({
      action:      'operator_note_added',
      actorUserId: operatorId ?? null,
      entityType:  'EmergencyIncident',
      entityId:    serverIncidentId,
      metadata:    { noteLength: note.length },
    });

    return toServerIncident(updated);
  } catch (err) {
    throw wrapPrismaError(err);
  }
}

/**
 * Updates the assigned operator and/or agency for an incident.
 */
export async function updateIncidentAssignment(
  serverIncidentId: string,
  req: AssignmentRequest
): Promise<ServerIncident> {
  try {
    const existing = await prisma.emergencyIncident.findUnique({
      where: { serverIncidentId },
      select: { id: true },
    });
    if (!existing) throw new ServiceError('NOT_FOUND', `Incident ${serverIncidentId} not found`);

    const updated = await prisma.emergencyIncident.update({
      where: { id: existing.id },
      data: {
        assignedOperatorId: req.assignedOperatorId ?? null,
        assignedAgency:     req.assignedAgency     ?? null,
      },
      include: INCIDENT_INCLUDE,
    });

    logAuditEvent({
      action:      'assignment_changed',
      actorUserId: req.operatorId ?? null,
      entityType:  'EmergencyIncident',
      entityId:    serverIncidentId,
      metadata:    {
        assignedOperatorId: req.assignedOperatorId ?? null,
        assignedAgency:     req.assignedAgency     ?? null,
      },
    });

    return toServerIncident(updated);
  } catch (err) {
    throw wrapPrismaError(err);
  }
}

/**
 * Checks if the database is reachable.
 * Used by GET /api/emergency/health/db.
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  incidentCount?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const count = await prisma.emergencyIncident.count();
    return { healthy: true, latencyMs: Date.now() - start, incidentCount: count };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { healthy: false, latencyMs: Date.now() - start, error: message };
  }
}
