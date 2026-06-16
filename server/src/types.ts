/**
 * types.ts
 * Shared type definitions for the Emergency SDK mock backend.
 *
 * These types mirror the mobile SDK's EmergencyPacket shape so the server
 * can ingest packets directly without transformation in development.
 *
 * Future integrations:
 * - RapidSOS PULSE: map ServerIncident → PULSE /incidents schema on ingest
 * - CAD (Motorola, Tyler, Hexagon): map to CAD incident record on PATCH /status
 * - NG911 ESInet: route dispatch notification to the correct PSAP on 'dispatched'
 */

// ─── Incident Status ──────────────────────────────────────────────────────────

export type IncidentStatus =
  | 'queued'        // Received, not yet reviewed
  | 'received'      // Acknowledged by a human operator
  | 'reviewing'     // Operator actively reviewing
  | 'dispatched'    // Field unit assigned and en route
  | 'acknowledged'  // Victim confirmed contact with responder
  | 'resolved'      // Incident closed successfully
  | 'false_alarm'   // Closed as no action needed
  | 'closed';       // Administratively closed

export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  'queued',
  'received',
  'reviewing',
  'dispatched',
  'acknowledged',
  'resolved',
  'false_alarm',
  'closed',
];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  queued: 'Queued',
  received: 'Received',
  reviewing: 'Reviewing',
  dispatched: 'Dispatched',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  false_alarm: 'False Alarm',
  closed: 'Closed',
};

export const INCIDENT_STATUS_COLORS: Record<IncidentStatus, string> = {
  queued: '#7B5EA7',
  received: '#1565C0',
  reviewing: '#E65C00',
  dispatched: '#F0A500',
  acknowledged: '#00838F',
  resolved: '#2E7D32',
  false_alarm: '#555555',
  closed: '#333333',
};

// ─── Nearest Resource (mirrored from mobile SDK) ──────────────────────────────

export interface NearestResource {
  id: string;
  name: string;
  type: string;
  phone: string;
  county: string;
  latitude: number;
  longitude: number;
  address?: string;
  distanceMiles: number;
}

// ─── Incoming packet from mobile SDK ─────────────────────────────────────────

export interface IncomingPacket {
  id: string;
  incidentType: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: string;
  userId: string;
  deviceId: string;
  appVersion: string;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  batteryState?: string;
  lowPowerModeEnabled?: boolean | null;
  staleLocation?: boolean;
  signalStatus: string;
  networkType: string;
  nearestResource: NearestResource | null;
  additionalNotes: string;
  status: string;
  sentAt: string | null;
  retryCount: number;
  /** Expo push token from the mobile device. Stored on the incident for status-change notifications. */
  pushToken?: string | null;
}

// ─── Server-side Incident record ──────────────────────────────────────────────

export interface ServerIncident {
  // Original packet data
  packetId: string;
  incidentType: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  packetTimestamp: string;
  userId: string;
  deviceId: string;
  appVersion: string;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  signalStatus: string;
  networkType: string;
  nearestResource: NearestResource | null;
  additionalNotes: string;
  retryCount: number;

  // Server-assigned fields
  serverIncidentId: string;
  status: IncidentStatus;
  receivedAt: string;      // ISO 8601 — when server first received it
  updatedAt: string;       // ISO 8601 — last status change
  operatorNotes: string;   // Free-text notes added by dashboard operator
  statusHistory: StatusHistoryEntry[];
  sourceApp: string;
  staleLocation: boolean;
  batteryState: string;
  assignedOperatorId: string | null;
  assignedAgency: string | null;
}

export interface StatusHistoryEntry {
  fromStatus: IncidentStatus | null;  // null for the initial 'queued' entry
  status: IncidentStatus;             // toStatus
  changedAt: string;                  // ISO 8601
  operatorNote?: string;
  changedById?: string | null;        // operatorId if provided
}

// ─── API Request / Response shapes ───────────────────────────────────────────

export interface CreateIncidentResponse {
  success: boolean;
  incidentId: string;       // Server-assigned incident ID returned to mobile
  message: string;
  timestamp: string;
}

export interface UpdateStatusRequest {
  status: IncidentStatus;
  operatorNote?: string;
  operatorId?: string;     // forwarded to audit log as actorUserId
}

export interface NoteRequest {
  note: string;
  operatorId?: string;
}

export interface AssignmentRequest {
  assignedOperatorId?: string | null;
  assignedAgency?: string | null;
  operatorId?: string;
}

export interface UpdateStatusResponse {
  success: boolean;
  incident: ServerIncident;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  timestamp: string;
}
