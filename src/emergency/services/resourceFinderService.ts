/**
 * resourceFinderService.ts
 * Finds the nearest emergency resource to a given GPS coordinate.
 * Uses the Haversine formula for great-circle distance calculation.
 *
 * Future integrations:
 * - Remote resource DB: swap local JSON with a fetch to a state-hosted API
 *   (e.g., Michigan DNR resource endpoint, PSAP locator service)
 * - NG911 ESRP: query the Emergency Service Routing Proxy to find the
 *   appropriate PSAP for a given lat/lon (RFC 6443 / NENA i3 standard)
 * - Mapbox Isochrone: find resources reachable within N minutes by boat/trail
 * - Offline tile cache: combine with Mapbox offline to show resources on map
 *   without internet
 */

import type {
  EmergencyResource,
  NearestResource,
  ResourceType,
} from '../types/emergency.types';

// Local JSON database — bundled with the app for fully offline operation
import resourceData from '../data/michiganEmergencyResources.json';

// ─── Resource Loading ─────────────────────────────────────────────────────────

/**
 * Returns all resources from the bundled local JSON.
 *
 * Future: merge with remote fetch result if online, fall back to local if not.
 */
export function getAllResources(): EmergencyResource[] {
  return resourceData.resources as EmergencyResource[];
}

/**
 * Filters resources by type.
 */
export function getResourcesByType(type: ResourceType): EmergencyResource[] {
  return getAllResources().filter((r) => r.type === type);
}

/**
 * Filters resources by county name (case-insensitive).
 */
export function getResourcesByCounty(county: string): EmergencyResource[] {
  return getAllResources().filter(
    (r) => r.county.toLowerCase() === county.toLowerCase()
  );
}

// ─── Nearest Resource ─────────────────────────────────────────────────────────

/**
 * Finds the single nearest resource to the provided coordinates.
 * Optionally restrict to a specific resource type.
 *
 * Returns null if no resources are available.
 * Attaches a LOCATION_OUTSIDE_MICHIGAN_DEMO_RANGE warning when distanceMiles > 500
 * (e.g., iOS Simulator defaulting to Apple HQ in Cupertino, CA).
 */
export function findNearestResource(
  latitude: number,
  longitude: number,
  filterType?: ResourceType
): NearestResource | null {
  let resources = getAllResources();

  if (filterType) {
    resources = resources.filter((r) => r.type === filterType);
  }

  if (resources.length === 0) return null;

  let nearest: NearestResource | null = null;
  let minDistance = Infinity;

  for (const resource of resources) {
    const distanceMiles = haversineDistanceMiles(
      latitude,
      longitude,
      resource.latitude,
      resource.longitude
    );

    if (distanceMiles < minDistance) {
      minDistance = distanceMiles;
      nearest = attachDistanceWarning({ ...resource, distanceMiles });
    }
  }

  return nearest;
}

/**
 * Returns the N nearest resources, sorted by distance ascending.
 * Useful for showing a "nearby resources" list to the user.
 */
export function findNearestResources(
  latitude: number,
  longitude: number,
  count: number = 3,
  filterType?: ResourceType
): NearestResource[] {
  let resources = getAllResources();

  if (filterType) {
    resources = resources.filter((r) => r.type === filterType);
  }

  const withDistance: NearestResource[] = resources.map((resource) => (
    attachDistanceWarning({
      ...resource,
      distanceMiles: haversineDistanceMiles(
        latitude,
        longitude,
        resource.latitude,
        resource.longitude
      ),
    })
  ));

  return withDistance
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, count);
}

// ─── Haversine Distance ───────────────────────────────────────────────────────

const EARTH_RADIUS_MILES = 3_958.8;

/**
 * Calculates the great-circle distance between two GPS coordinates in miles.
 * Haversine formula — accurate to within ~0.5% for typical distances.
 *
 * Reference: https://en.wikipedia.org/wiki/Haversine_formula
 */
export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Formats a distance in miles for display.
 * Shows one decimal for < 10 miles, whole number for >= 10 miles.
 */
export function formatDistanceMiles(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// ─── Distance Warning ─────────────────────────────────────────────────────────

const OUT_OF_SERVICE_AREA_MILES = 500;

/**
 * Attaches LOCATION_OUTSIDE_MICHIGAN_DEMO_RANGE warning when distanceMiles > 500.
 * This catches simulator-default coordinates (Cupertino, Tokyo, etc.) that would
 * produce nonsensical "nearest resource: 1,847 miles" results without explanation.
 *
 * The resource result is NOT suppressed — operators see the closest Michigan
 * resource regardless, with a clear warning in the UI and packet.
 */
export function attachDistanceWarning(
  resource: NearestResource
): NearestResource {
  if (resource.distanceMiles > OUT_OF_SERVICE_AREA_MILES) {
    return { ...resource, warning: 'LOCATION_OUTSIDE_MICHIGAN_DEMO_RANGE' };
  }
  return resource;
}
