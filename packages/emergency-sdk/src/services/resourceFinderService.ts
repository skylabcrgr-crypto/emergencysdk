/**
 * resourceFinderService.ts
 * Finds the nearest emergency resource to a given GPS coordinate.
 * Uses the Haversine formula for great-circle distance calculation.
 *
 * Resource loading strategy (offline-first):
 *   1. In-memory cache (fastest; populated by loadResources / refresh).
 *   2. When ONLINE  → fetch latest dataset from the backend and cache it
 *      both in memory and in AsyncStorage for the next cold start.
 *   3. When OFFLINE → use the last AsyncStorage-cached dataset if present.
 *   4. Always fall back to the bundled JSON so the SDK works with zero setup
 *      and zero connectivity.
 *
 * Future integrations:
 * - NG911 ESRP: query the Emergency Service Routing Proxy to find the
 *   appropriate PSAP for a given lat/lon (RFC 6443 / NENA i3 standard)
 * - Mapbox Isochrone: find resources reachable within N minutes by boat/trail
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  EmergencyResource,
  NearestResource,
  ResourceType,
} from '../types/emergency.types';
import { getOnlineDecision } from './networkService';

// Local JSON database — bundled with the app for fully offline operation
import resourceData from '../data/michiganEmergencyResources.json';

// ─── Cache state ──────────────────────────────────────────────────────────────

const CACHE_STORAGE_KEY = '@er_sdk/resource_dataset_v1';

const BUNDLED_RESOURCES = resourceData.resources as EmergencyResource[];

interface CachedDataset {
  version: string;
  fetchedAt: string;       // ISO 8601
  source: 'backend' | 'bundled' | 'storage';
  resources: EmergencyResource[];
}

// In-memory cache — starts with the bundled dataset so synchronous callers
// (findNearestResource, etc.) always have data even before loadResources runs.
let memoryCache: EmergencyResource[] = BUNDLED_RESOURCES;
let lastSource: CachedDataset['source'] = 'bundled';

// ─── Resource Loading ─────────────────────────────────────────────────────────

/**
 * Returns the currently cached resource list (synchronous).
 * Defaults to the bundled JSON until loadResources / refresh populates it.
 */
export function getAllResources(): EmergencyResource[] {
  return memoryCache;
}

/** Indicates where the current in-memory dataset came from. */
export function getResourceSource(): CachedDataset['source'] {
  return lastSource;
}

/**
 * Initializes the in-memory cache on app start.
 * Order: AsyncStorage cache (if any) → bundled JSON.
 * Does NOT hit the network — call refreshResourcesFromBackend() for that.
 */
export async function loadResources(): Promise<EmergencyResource[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedDataset;
      if (Array.isArray(parsed.resources) && parsed.resources.length > 0) {
        memoryCache = parsed.resources;
        lastSource = 'storage';
        return memoryCache;
      }
    }
  } catch {
    // Corrupt cache — ignore and fall back to bundled.
  }
  memoryCache = BUNDLED_RESOURCES;
  lastSource = 'bundled';
  return memoryCache;
}

/**
 * Fetches the latest resource dataset from the backend when online,
 * updates the in-memory + AsyncStorage cache, and returns the resources.
 *
 * On any failure (offline, network error, bad payload) it returns the
 * current cache unchanged — the SDK never goes resource-less.
 *
 * @param apiBaseUrl e.g. "https://emergencysdk.vercel.app" or "http://localhost:3001"
 */
export async function refreshResourcesFromBackend(
  apiBaseUrl: string
): Promise<EmergencyResource[]> {
  try {
    const decision = await getOnlineDecision();
    if (!decision.shouldAttemptNetworkSend) {
      // Offline — keep whatever we have (storage or bundled).
      return memoryCache;
    }

    const url = `${apiBaseUrl.replace(/\/$/, '')}/api/emergency/resources`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = (await res.json()) as { resources?: EmergencyResource[] };
    if (!body.resources || body.resources.length === 0) {
      // Empty backend dataset — don't clobber a good local cache.
      return memoryCache;
    }

    memoryCache = body.resources;
    lastSource = 'backend';

    const payload: CachedDataset = {
      version: resourceData.version ?? '0.0.0',
      fetchedAt: new Date().toISOString(),
      source: 'backend',
      resources: body.resources,
    };
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload)).catch(() => {});

    return memoryCache;
  } catch {
    // Network/parse failure — fall back to whatever is cached.
    return memoryCache;
  }
}

/**
 * Clears the persisted resource cache (next loadResources falls back to bundled).
 */
export async function clearResourceCache(): Promise<void> {
  memoryCache = BUNDLED_RESOURCES;
  lastSource = 'bundled';
  await AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
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
