/**
 * emergencyPacketService.ts
 * Builds and transmits emergency packets.
 *
 * Future integrations:
 * - RapidSOS PULSE API: replace mockApiSend with authenticated POST to
 *   https://api.rapidsos.com/v3/incidents  (requires API key + OAuth token)
 * - NG911 (i3 standard): encode packet as SIP INVITE with PIDF-LO body for
 *   PSAP direct delivery over ESInet
 * - CAD (Computer-Aided Dispatch): map EmergencyPacket to CAD incident schema
 *   (e.g., Motorola PremierOne, Tyler New World, Hexagon) via REST or SOAP
 * - Satellite uplink: JSON.stringify(packet) → compressed buffer →
 *   Iridium SBD or Starlink IoT endpoint
 * - LoRa mesh: transmit mini-packet (lat, lon, type) over LoRaWAN when
 *   cellular is unavailable; full packet delivered when relay reaches gateway
 */

import { Platform } from 'react-native';
import type {
  EmergencyPacket,
  EmergencyAPIResponse,
  EmergencyLocation,
  IncidentType,
  NearestResource,
} from '../types/emergency.types';
import { getSignalStatus, getNetworkState } from './networkService';

// ─── Packet Factory ───────────────────────────────────────────────────────────

/**
 * Builds a complete EmergencyPacket from acquired location data.
 * All placeholder fields (userId, deviceId, batteryLevel) are clearly
 * marked for replacement with real app-specific values.
 */
export async function buildEmergencyPacket(params: {
  location: EmergencyLocation;
  incidentType: IncidentType;
  additionalNotes?: string;
  nearestResource?: NearestResource | null;
  // Replace these placeholders with real values from your app's auth & device APIs
  userId?: string;
  deviceId?: string;
  appVersion?: string;
  // Battery fields — injected from batteryService.getBatterySnapshot()
  batteryLevel?: number | null;         // raw 0.0–1.0
  batteryCharging?: boolean | null;     // derived from batteryState
  batteryState?: 'unknown' | 'unplugged' | 'charging' | 'full';
  lowPowerModeEnabled?: boolean | null;
}): Promise<EmergencyPacket> {
  const [signalStatus, networkState] = await Promise.all([
    getSignalStatus(),
    getNetworkState(),
  ]);

  const id = generateUUID();

  return {
    id,
    incidentType: params.incidentType,
    latitude: params.location.latitude,
    longitude: params.location.longitude,
    accuracy: params.location.accuracy,
    altitude: params.location.altitude,
    timestamp: new Date().toISOString(),

    // ── Placeholder fields — replace with real values in production ──────────
    userId: params.userId ?? 'anonymous-user',
    deviceId: params.deviceId ?? `${Platform.OS}-device`,
    appVersion: params.appVersion ?? '0.0.0',
    batteryLevel: params.batteryLevel ?? null,
    batteryCharging: params.batteryCharging ?? null,
    batteryState: params.batteryState ?? 'unknown',
    lowPowerModeEnabled: params.lowPowerModeEnabled ?? null,
    staleLocation: params.location.staleLocation ?? false,
    // ─────────────────────────────────────────────────────────────────────────

    signalStatus,
    networkType: networkState.type,
    nearestResource: params.nearestResource ?? null,
    additionalNotes: params.additionalNotes ?? '',
    status: 'draft',
    sentAt: null,
    retryCount: 0,
  };
}

// ─── Transmission ─────────────────────────────────────────────────────────────

/**
 * Sends an emergency packet to the configured API endpoint.
 *
 * Currently uses a mock implementation that simulates network delay.
 *
 * PRODUCTION REPLACEMENT:
 * Replace the mock body with a real fetch() POST to your emergency API,
 * e.g., RapidSOS PULSE, your state's NG911 gateway, or internal CAD REST API.
 *
 * Example:
 *   const response = await fetch('https://api.rapidsos.com/v3/incidents', {
 *     method: 'POST',
 *     headers: {
 *       'Authorization': `Bearer ${RAPIDSOS_TOKEN}`,
 *       'Content-Type': 'application/json',
 *     },
 *     body: JSON.stringify(mapToRapidSOSPayload(packet)),
 *   });
 */
export async function sendPacketToAPI(
  packet: EmergencyPacket,
  apiUrl?: string
): Promise<EmergencyAPIResponse> {
  // ── Mock API send (replace in production) ────────────────────────────────
  if (!apiUrl) {
    return mockApiSend(packet);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packet),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<EmergencyAPIResponse>;
}

/**
 * Mock API send — simulates a successful or failed API call.
 * Remove in production and wire to a real dispatch endpoint.
 */
async function mockApiSend(
  packet: EmergencyPacket
): Promise<EmergencyAPIResponse> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 1200));

  console.log('[EmergencySDK] Mock API send:', JSON.stringify(packet, null, 2));

  return {
    success: true,
    incidentId: `MOCK-${packet.id.slice(0, 8).toUpperCase()}`,
    message: 'Emergency packet received (mock). No real dispatch has occurred.',
    timestamp: new Date().toISOString(),
  };
}

// ─── UUID Generator ───────────────────────────────────────────────────────────

/**
 * RFC 4122 v4 UUID — crypto-quality randomness via Math.random fallback.
 * In production, prefer the `uuid` npm package for crypto.getRandomValues support.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
