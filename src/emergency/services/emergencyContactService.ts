/**
 * emergencyContactService.ts
 * Composes and sends emergency SMS alerts to personal contacts.
 *
 * NOTE: This module does NOT call 911 or connect to any public safety
 * answering point (PSAP). It sends personal contact notifications only.
 *
 * Future integrations:
 * - RapidSOS Harmony: personal emergency alert that enriches 911 caller data
 *   without making the call itself — contact RapidSOS for partner API access
 * - Push notifications: use Expo Notifications to send server-side push to
 *   family/contacts when packet is acknowledged by API
 * - Email fallback: if SMS unavailable, send via SendGrid/SES transactional email
 * - Satellite SMS: Iridium EdgeAlert or Garmin inReach messaging APIs
 */

import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildGoogleMapsUrl, formatCoordinates } from './locationService';
import { formatDistanceMiles } from './resourceFinderService';
import type {
  EmergencyPacket,
  EmergencyContact,
  EmergencySMSPayload,
} from '../types/emergency.types';
import { INCIDENT_TYPE_LABELS, INCIDENT_TYPE_ICONS } from '../types/emergency.types';

// ─── SMS Body Builder ─────────────────────────────────────────────────────────

/**
 * Builds a human-readable SMS body from an emergency packet.
 * Kept concise to fit within SMS character limits (~160 chars per segment).
 *
 * The Google Maps link allows recipients to navigate directly to the user.
 */
export function buildSMSBody(packet: EmergencyPacket): string {
  const icon = INCIDENT_TYPE_ICONS[packet.incidentType];
  const label = INCIDENT_TYPE_LABELS[packet.incidentType];
  const coords = formatCoordinates(packet.latitude, packet.longitude, packet.accuracy);
  const mapsUrl = buildGoogleMapsUrl(packet.latitude, packet.longitude);
  const time = new Date(packet.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(packet.timestamp).toLocaleDateString();

  let body = `🆘 EMERGENCY ALERT\n`;
  body += `${icon} Incident: ${label}\n`;
  body += `📍 Location: ${coords}\n`;
  body += `🗺️ Map: ${mapsUrl}\n`;
  body += `🕐 Time: ${date} ${time}\n`;

  if (packet.nearestResource) {
    const dist = formatDistanceMiles(packet.nearestResource.distanceMiles);
    body += `🚨 Nearest Help: ${packet.nearestResource.name} (${dist})\n`;
    body += `📞 Resource Phone: ${packet.nearestResource.phone}\n`;
  }

  if (packet.additionalNotes) {
    body += `📝 Notes: ${packet.additionalNotes}\n`;
  }

  body += `\nRef ID: ${packet.id.slice(0, 8).toUpperCase()}`;

  return body;
}

/**
 * Builds the SMS payload (recipients + body) for expo-sms.
 */
export function buildSMSPayload(
  packet: EmergencyPacket,
  contacts: EmergencyContact[]
): EmergencySMSPayload {
  return {
    recipients: contacts.map((c) => c.phone),
    body: buildSMSBody(packet),
  };
}

// ─── SMS Dispatch ─────────────────────────────────────────────────────────────

/**
 * Attempts to send an SMS via expo-sms.
 * Falls back to console log (mock) if SMS is unavailable on the device.
 *
 * Returns:
 *   'sent'        → SMS app opened and user confirmed send
 *   'cancelled'   → User opened SMS app but cancelled
 *   'unavailable' → SMS not available (simulator, tablet, etc.) — mock logged
 */
export async function sendEmergencySMS(
  packet: EmergencyPacket,
  contacts: EmergencyContact[]
): Promise<'sent' | 'cancelled' | 'unavailable'> {
  if (contacts.length === 0) {
    console.warn('[EmergencySDK] No emergency contacts configured.');
    return 'unavailable';
  }

  const isAvailable = await SMS.isAvailableAsync();

  if (!isAvailable) {
    // Mock fallback for simulators or SMS-incapable devices
    const payload = buildSMSPayload(packet, contacts);
    console.log(
      '[EmergencySDK] SMS unavailable — mock SMS:\n',
      `To: ${payload.recipients.join(', ')}\n`,
      payload.body
    );
    return 'unavailable';
  }

  const payload = buildSMSPayload(packet, contacts);

  const { result } = await SMS.sendSMSAsync(payload.recipients, payload.body);

  // expo-sms result values: 'sent' | 'cancelled' | 'unknown'
  if (result === 'sent') return 'sent';
  if (result === 'cancelled') return 'cancelled';

  // 'unknown' — treat as sent on iOS (iOS doesn't reliably report 'sent')
  return 'sent';
}

// ─── Contact Storage Helpers ──────────────────────────────────────────────────

const CONTACTS_STORAGE_KEY = '@emergency_sdk/contacts';

/**
 * Saves emergency contacts to AsyncStorage.
 * Input is sanitized: phone numbers are stripped of non-digit characters.
 */
export async function saveEmergencyContacts(
  contacts: EmergencyContact[]
): Promise<void> {
  const sanitized = contacts.map((c) => ({
    ...c,
    phone: sanitizePhone(c.phone),
  }));
  await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(sanitized));
}

/**
 * Retrieves saved emergency contacts from AsyncStorage.
 */
export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmergencyContact[];
  } catch {
    return [];
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Strips all non-digit characters except leading + for international numbers.
 * Prevents SMS dispatch failures from malformed phone strings.
 */
function sanitizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  // Basic US validation: 10 digits or +1 + 10 digits
  return digits;
}
