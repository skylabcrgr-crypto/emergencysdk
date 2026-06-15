/**
 * incidents.store.ts
 * In-memory incident store with seed data for demo purposes.
 *
 * This replaces a real database in the prototype. The store is a simple
 * Map<serverIncidentId, ServerIncident> held in process memory.
 *
 * Future upgrades (swap drop-in):
 * - PostgreSQL: replace Map operations with pg/knex queries
 * - SQLite: use better-sqlite3 for a file-backed single-server store
 * - Firestore: real-time updates to dashboard without polling
 * - Redis pub/sub: push status changes to dashboard over WebSocket
 */

import type { ServerIncident, IncidentStatus, StatusHistoryEntry } from '../types';

// ─── Store ────────────────────────────────────────────────────────────────────

const store = new Map<string, ServerIncident>();

// ─── Seed Data ────────────────────────────────────────────────────────────────

function makeSeed(
  packetId: string,
  serverIncidentId: string,
  incidentType: string,
  lat: number,
  lon: number,
  status: IncidentStatus,
  userId: string,
  additionalNotes: string,
  minutesAgo: number,
  nearestResourceName: string,
  nearestPhone: string,
  distanceMiles: number
): ServerIncident {
  const receivedAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  return {
    packetId,
    serverIncidentId,
    incidentType,
    latitude: lat,
    longitude: lon,
    accuracy: 8,
    altitude: null,
    packetTimestamp: receivedAt,
    userId,
    deviceId: 'ios-device',
    appVersion: '1.0.0',
    batteryLevel: 0.62,
    batteryCharging: false,
    signalStatus: 'weak',
    networkType: 'cellular',
    nearestResource: {
      id: 'seed-resource',
      name: nearestResourceName,
      type: 'state_police',
      phone: nearestPhone,
      county: 'Otsego',
      latitude: lat + 0.05,
      longitude: lon + 0.05,
      distanceMiles,
    },
    additionalNotes,
    retryCount: 0,
    status,
    receivedAt,
    updatedAt: receivedAt,
    operatorNotes: '',
    statusHistory: [{ status, changedAt: receivedAt }],
  };
}

// Pre-seed three realistic demo incidents
store.set('INC-0001', makeSeed(
  'a1b2c3d4-0001', 'INC-0001', 'lost',
  45.0200, -84.6800, 'reviewing',
  'user-fisher-001', 'Lost on trail near Elk River, last seen marker 14',
  47, 'Michigan State Police - Gaylord Post', '989-732-5141', 3.2
));

store.set('INC-0002', makeSeed(
  'a1b2c3d4-0002', 'INC-0002', 'boating',
  44.3100, -84.7600, 'dispatched',
  'user-boater-099', 'Engine failure, taking on water',
  12, 'Houghton Lake Public Marina', '989-422-3111', 1.8
));

store.set('INC-0003', makeSeed(
  'a1b2c3d4-0003', 'INC-0003', 'medical',
  46.4090, -86.6570, 'queued',
  'user-hiker-442', 'Suspected broken ankle, 2 miles in on Pictured Rocks trail',
  3, 'Alger County Sheriff', '906-387-4444', 5.1
));

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export function getAllIncidents(): ServerIncident[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
}

export function getIncidentById(id: string): ServerIncident | undefined {
  return store.get(id);
}

export function createIncident(incident: ServerIncident): void {
  store.set(incident.serverIncidentId, incident);
}

export function updateIncidentStatus(
  id: string,
  newStatus: IncidentStatus,
  operatorNote?: string
): ServerIncident | null {
  const incident = store.get(id);
  if (!incident) return null;

  const historyEntry: StatusHistoryEntry = {
    status: newStatus,
    changedAt: new Date().toISOString(),
    ...(operatorNote ? { operatorNote } : {}),
  };

  const updated: ServerIncident = {
    ...incident,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    operatorNotes: operatorNote
      ? `${incident.operatorNotes ? incident.operatorNotes + '\n' : ''}[${new Date().toLocaleTimeString()}] ${operatorNote}`
      : incident.operatorNotes,
    statusHistory: [...incident.statusHistory, historyEntry],
  };

  store.set(id, updated);
  return updated;
}

/**
 * Generates the next server-side incident ID.
 * Format: INC-XXXX (zero-padded sequential)
 * Future: replace with UUID or database auto-increment.
 */
export function generateIncidentId(): string {
  const count = store.size + 1;
  return `INC-${String(count).padStart(4, '0')}`;
}
