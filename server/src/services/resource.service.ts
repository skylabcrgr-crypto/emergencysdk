/**
 * resource.service.ts
 * Prisma-backed read service for emergency resources.
 *
 * Powers:
 *   GET /api/emergency/resources
 *   GET /api/emergency/resources/nearest?lat=&lng=&type=
 */

import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { ServiceError } from './incident.service';

export interface ResourceRecord {
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

export interface NearestResourceRecord extends ResourceRecord {
  distanceMiles: number;
}

// ─── Haversine ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_MILES = 3_958.8;

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function wrap(err: unknown): ServiceError {
  if (err instanceof ServiceError) return err;
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new ServiceError('DB_UNAVAILABLE', 'Database is not reachable. Check DATABASE_URL.');
  }
  return new ServiceError('UNKNOWN', err instanceof Error ? err.message : 'Unknown error');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all resources, optionally filtered by type and/or county.
 */
export async function getResources(filters?: {
  type?: string;
  county?: string;
}): Promise<ResourceRecord[]> {
  try {
    const where: Prisma.EmergencyResourceWhereInput = {};
    if (filters?.type)   where.type   = filters.type;
    if (filters?.county) where.county = { equals: filters.county, mode: 'insensitive' };

    return await prisma.emergencyResource.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  } catch (err) {
    throw wrap(err);
  }
}

/**
 * Returns the N nearest resources to (lat, lng), sorted ascending by distance.
 * Optionally restricts to a single resource type.
 */
export async function getNearestResources(
  lat: number,
  lng: number,
  opts?: { type?: string; limit?: number }
): Promise<NearestResourceRecord[]> {
  try {
    const where: Prisma.EmergencyResourceWhereInput = {};
    if (opts?.type) where.type = opts.type;

    const all = await prisma.emergencyResource.findMany({ where });

    return all
      .map((r) => ({ ...r, distanceMiles: haversineMiles(lat, lng, r.latitude, r.longitude) }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, opts?.limit ?? 5);
  } catch (err) {
    throw wrap(err);
  }
}
