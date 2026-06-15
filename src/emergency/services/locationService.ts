/**
 * locationService.ts
 * Handles GPS location acquisition for emergency packet creation.
 *
 * Future integrations:
 * - Satellite fallback: if no cellular, trigger Iridium/Starlink location ping
 * - LoRa mesh: if location acquired, broadcast coordinates over LoRaWAN beacon
 * - Mapbox Offline: reverse-geocode coordinates to human-readable address for operators
 */

import * as Location from 'expo-location';
import type { EmergencyLocation } from '../types/emergency.types';

const LOCATION_TIMEOUT_MS = 15_000;
const HIGH_ACCURACY_TIMEOUT_MS = 20_000;

/**
 * Requests foreground location permission from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Checks current permission status without prompting.
 */
export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Acquires the current GPS position with high accuracy.
 * Falls back to balanced accuracy if high accuracy times out.
 *
 * Future: add satellite fallback here if isConnected === false and
 * satellite hardware is detected (e.g., Garmin inReach SDK integration point).
 *
 * Strategy (per Expo docs recommendation):
 *   1. Try getLastKnownPositionAsync — returns immediately if cache exists.
 *      Marked as staleLocation: true so operators/UI know it's cached.
 *   2. Race getCurrentPositionAsync (high accuracy) against a 20-second timeout.
 *   3. If high accuracy times out, race getCurrentPositionAsync (balanced) against
 *      a 15-second timeout.
 *   4. If all live attempts fail AND a last-known position exists, use it with
 *      staleLocation: true rather than failing completely.
 *
 * Production note: staleLocation packets should be flagged for human review.
 * For a real emergency system, require fresh GPS or satellite confirmation.
 */
export async function getCurrentLocation(): Promise<EmergencyLocation> {
  const hasPermission = await requestLocationPermission();

  if (!hasPermission) {
    throw new Error(
      'Location permission denied. Cannot determine your position.'
    );
  }

  // Step 1: Grab last-known position as an instant fallback reference.
  // getLastKnownPositionAsync returns null if no cached fix exists.
  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000, // accept cached positions up to 5 minutes old
    requiredAccuracy: 200,  // must be within 200m to be useful
  }).catch(() => null);

  // Step 2: Attempt fresh GPS fix (high accuracy → balanced fallback)
  const livePosition = await (async (): Promise<Location.LocationObject | null> => {
    try {
      return await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('High-accuracy GPS timeout')), HIGH_ACCURACY_TIMEOUT_MS)
        ),
      ]);
    } catch {
      try {
        // Fallback: balanced accuracy — faster fix, slightly less precise
        return await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GPS acquisition failed — no signal')), LOCATION_TIMEOUT_MS)
          ),
        ]);
      } catch {
        return null; // Both live attempts failed — will use lastKnown below
      }
    }
  })();

  // Step 3: Resolve which position to use
  const position = livePosition ?? lastKnown;

  if (!position) {
    throw new Error(
      'GPS unavailable — no live fix and no cached position. Move to an open area and try again.'
    );
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 999,
    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp,
    staleLocation: livePosition === null, // true only if using the cached fallback
  };
}

/**
 * Returns a Google Maps URL for the given coordinates.
 * Included in SMS body so responders can tap directly into navigation.
 */
export function buildGoogleMapsUrl(
  latitude: number,
  longitude: number
): string {
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/**
 * Returns a formatted coordinate string for display and SMS.
 */
export function formatCoordinates(
  latitude: number,
  longitude: number,
  accuracy?: number
): string {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  const acc = accuracy !== undefined ? ` (±${Math.round(accuracy)}m)` : '';
  return `${lat}, ${lon}${acc}`;
}
