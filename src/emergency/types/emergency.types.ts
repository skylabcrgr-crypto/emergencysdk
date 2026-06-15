/**
 * emergency.types.ts
 * Central type definitions for the Emergency Response SDK.
 *
 * Future integration points:
 * - RapidSOS PULSE API: EmergencyPacket maps to their /incidents payload
 * - NG911 (i3 standard): incidentType → ESInet call type codes
 * - CAD (Computer-Aided Dispatch): EmergencyPacket → CAD incident record
 * - Satellite (Iridium/Starlink): serialized packet ready for low-bandwidth transmission
 * - LoRa mesh: packet can be chunked and sent over LoRaWAN in compressed form
 */

// ─── Incident Types ───────────────────────────────────────────────────────────

export type IncidentType =
  | 'medical'
  | 'lost'
  | 'boating'
  | 'fishing'
  | 'hiking'
  | 'vehicle'
  | 'wildlife'
  | 'other';

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  medical: 'Medical Emergency',
  lost: 'Lost / Stranded',
  boating: 'Boating Incident',
  fishing: 'Fishing Emergency',
  hiking: 'Hiking / Trail Incident',
  vehicle: 'Vehicle Breakdown',
  wildlife: 'Wildlife Encounter',
  other: 'Other Emergency',
};

export const INCIDENT_TYPE_ICONS: Record<IncidentType, string> = {
  medical: '🚑',
  lost: '🧭',
  boating: '⛵',
  fishing: '🎣',
  hiking: '🥾',
  vehicle: '🚗',
  wildlife: '🐻',
  other: '🆘',
};

// ─── Button / Flow States ─────────────────────────────────────────────────────

export type EmergencyButtonState =
  | 'idle'
  | 'requesting_location'
  | 'packet_created'
  | 'sending'
  | 'queued_offline'
  | 'sent'
  | 'failed';

// ─── Location ─────────────────────────────────────────────────────────────────

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number; // Unix ms
  /**
   * True when coordinates came from getLastKnownPositionAsync (cached GPS)
   * rather than a fresh getCurrentPositionAsync read.
   * Shown as a warning on the status card and included in the packet.
   */
  staleLocation?: boolean;
}

// ─── Emergency Resource (from local JSON / remote resource DB) ────────────────

export type ResourceType =
  | 'state_police'
  | 'county_sheriff'
  | 'coast_guard'
  | 'ranger_station'
  | 'hospital'
  | 'fire_station'
  | 'dnr_post'
  | 'search_and_rescue'
  | 'marina'
  | 'trailhead_office';

export interface EmergencyResource {
  id: string;
  name: string;
  type: ResourceType;
  phone: string;
  county: string;
  latitude: number;
  longitude: number;
  address?: string;
  hours?: string; // e.g. "24/7" or "Mon-Fri 8am-5pm"
  notes?: string;
}

export interface NearestResource extends EmergencyResource {
  distanceMiles: number;
  /**
   * Set when distanceMiles > 500 — indicates the device GPS is likely outside
   * the Michigan resource coverage area (e.g. iOS Simulator at Apple HQ).
   * Dashboard operators should note this is a demo-coverage warning, not an error.
   */
  warning?: 'LOCATION_OUTSIDE_MICHIGAN_DEMO_RANGE';
}

// ─── Emergency Packet ─────────────────────────────────────────────────────────

/**
 * Core data structure transmitted on SOS.
 *
 * Future integrations:
 * - RapidSOS: POST to https://api.rapidsos.com/v3/incidents with this payload (mapped)
 * - NG911 PIDF-LO: latitude/longitude → SIP INVITE PIDF-LO body
 * - CAD: this packet becomes the initial incident record, dispatched by operator
 * - Satellite fallback: JSON.stringify(packet) → compressed bytes → Iridium/SBD
 * - LoRa mesh: mini-packet (lat, lon, type, userId) relayed hop-by-hop to gateway
 */
export interface EmergencyPacket {
  id: string; // UUID v4
  incidentType: IncidentType;
  latitude: number;
  longitude: number;
  accuracy: number; // GPS accuracy in meters
  altitude: number | null;
  timestamp: string; // ISO 8601
  userId: string; // Placeholder: replace with real auth user ID
  deviceId: string; // Placeholder: replace with Expo Constants.deviceId
  appVersion: string; // Placeholder: replace with Constants.expoConfig.version
  batteryLevel: number | null;        // 0.0–1.0, null if unavailable
  batteryCharging: boolean | null;    // true if charging or full
  batteryState: 'unknown' | 'unplugged' | 'charging' | 'full'; // from expo-battery
  lowPowerModeEnabled: boolean | null; // Low Power Mode (iOS) / Battery Saver (Android)
  staleLocation: boolean;              // true if GPS came from last-known cache
  signalStatus: SignalStatus;
  networkType: string; // e.g. 'wifi', 'cellular', 'none'
  nearestResource: NearestResource | null;
  additionalNotes: string;
  status: PacketStatus;
  sentAt: string | null; // ISO 8601 or null
  retryCount: number;
}

export type PacketStatus =
  | 'draft'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'acknowledged'; // future: server-side ACK from RapidSOS / CAD

export type SignalStatus =
  | 'strong' // > -85 dBm or equivalent
  | 'weak'   // signal present but marginal
  | 'offline' // no connection
  | 'satellite' // future: Starlink / Iridium fallback
  | 'lora';    // future: LoRa mesh relay

// ─── Offline Queue ────────────────────────────────────────────────────────────

export interface QueuedPacket {
  packet: EmergencyPacket;
  queuedAt: string; // ISO 8601
  attemptCount: number;
}

// ─── SMS / Contact ────────────────────────────────────────────────────────────

export interface EmergencySMSPayload {
  recipients: string[];
  body: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

// ─── Network State ────────────────────────────────────────────────────────────

export interface NetworkState {
  isConnected: boolean;
  type: string; // 'wifi' | 'cellular' | 'none' | 'unknown'
  isInternetReachable: boolean | null;
}

// ─── API Response (mock / future real) ───────────────────────────────────────

export interface EmergencyAPIResponse {
  success: boolean;
  incidentId?: string; // future: returned by RapidSOS / CAD system
  message: string;
  timestamp: string;
}

// ─── SDK Config ───────────────────────────────────────────────────────────────

/**
 * Optional configuration passed when initializing the SDK.
 * Extend this to support per-app settings (e.g., state-specific resource URLs,
 * API keys for RapidSOS, Mapbox, or satellite provider credentials).
 */
export interface EmergencySDKConfig {
  appId: string;           // e.g. 'mi-fishing', 'mi-parks', 'mi-hunting'
  appVersion: string;
  emergencyApiUrl?: string; // future: POST target for real dispatch integration
  enableSatelliteFallback?: boolean; // future: Iridium/Starlink toggle
  enableLoraMesh?: boolean;          // future: LoRa mesh relay toggle
  defaultContacts?: EmergencyContact[];
  resourcesOverrideUrl?: string; // future: remote resource DB URL
}
