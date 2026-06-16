/**
 * types.ts
 * Dashboard-side type definitions — mirrors the server's types.ts.
 */

export type IncidentStatus =
  | 'queued'
  | 'received'
  | 'reviewing'
  | 'dispatched'
  | 'acknowledged'
  | 'resolved'
  | 'false_alarm'
  | 'closed';

export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  'queued', 'received', 'reviewing', 'dispatched', 'acknowledged', 'resolved', 'false_alarm', 'closed',
];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  queued:       'Queued',
  received:     'Received',
  reviewing:    'Reviewing',
  dispatched:   'Dispatched',
  acknowledged: 'Acknowledged',
  resolved:     'Resolved',
  false_alarm:  'False Alarm',
  closed:       'Closed',
};

export const INCIDENT_STATUS_COLORS: Record<IncidentStatus, string> = {
  queued:       '#7B5EA7',
  received:     '#1565C0',
  reviewing:    '#E65C00',
  dispatched:   '#F0A500',
  acknowledged: '#00838F',
  resolved:     '#2E7D32',
  false_alarm:  '#555555',
  closed:       '#333333',
};

export const INCIDENT_TYPE_ICONS: Record<string, string> = {
  medical: '🚑',
  lost: '🧭',
  boating: '⛵',
  fishing: '🎣',
  hiking: '🥾',
  vehicle: '🚗',
  wildlife: '🐻',
  other: '🆘',
};

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Emergency',
  lost: 'Lost / Stranded',
  boating: 'Boating Incident',
  fishing: 'Fishing Emergency',
  hiking: 'Hiking / Trail Incident',
  vehicle: 'Vehicle Breakdown',
  wildlife: 'Wildlife Encounter',
  other: 'Other Emergency',
};

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

// ─── Imported emergency resource (from /api/emergency/resources) ──────────────

export interface EmergencyResourceRecord {
  id: string;
  name: string;
  type: string;
  phone: string;
  county: string;
  latitude: number;
  longitude: number;
  address: string | null;
  hours: string | null;
  notes: string | null;
  agency: string | null;
  jurisdiction: string | null;
  resourceCategory: string | null;
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  state_police:      'State Police',
  county_sheriff:    'Sheriff',
  coast_guard:       'Coast Guard',
  ranger_station:    'Ranger Station',
  hospital:          'Hospital',
  fire_station:      'EMS / Fire',
  dnr_post:          'DNR Office',
  search_and_rescue: 'Search & Rescue',
  marina:            'Marina / Harbor',
  trailhead_office:  'State Park Office',
};

export const RESOURCE_TYPE_ICONS: Record<string, string> = {
  state_police:      '🚔',
  county_sheriff:    '⭐',
  coast_guard:       '⚓',
  ranger_station:    '🌲',
  hospital:          '🏥',
  fire_station:      '🚒',
  dnr_post:          '🦌',
  search_and_rescue: '🧗',
  marina:            '⛵',
  trailhead_office:  '🏕️',
};

export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  state_police:      '#1565C0',
  county_sheriff:    '#F0A500',
  coast_guard:       '#00838F',
  ranger_station:    '#2E7D32',
  hospital:          '#C62828',
  fire_station:      '#E65100',
  dnr_post:          '#558B2F',
  search_and_rescue: '#6A1B9A',
  marina:            '#0277BD',
  trailhead_office:  '#4E342E',
};

export interface StatusHistoryEntry {
  fromStatus: IncidentStatus | null;  // null for the initial 'queued' entry
  status: IncidentStatus;             // toStatus
  changedAt: string;
  operatorNote?: string;
  changedById?: string | null;
}

export interface ServerIncident {
  packetId: string;
  serverIncidentId: string;
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
  batteryState: string;
  signalStatus: string;
  networkType: string;
  nearestResource: NearestResource | null;
  additionalNotes: string;
  retryCount: number;
  status: IncidentStatus;
  receivedAt: string;
  updatedAt: string;
  operatorNotes: string;
  statusHistory: StatusHistoryEntry[];
  staleLocation: boolean;
  sourceApp: string;
  assignedOperatorId: string | null;
  assignedAgency: string | null;
}

// ─── Filter state (client-side) ───────────────────────────────────────────────

export interface FilterState {
  statuses:   IncidentStatus[];
  types:      string[];
  counties:   string[];
  agencies:   string[];
  sourceApps: string[];
  dateFrom:   string | null;   // YYYY-MM-DD
  dateTo:     string | null;   // YYYY-MM-DD
}
