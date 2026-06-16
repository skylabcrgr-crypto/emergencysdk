/**
 * resource.schema.ts
 * Zod schemas for emergency resource endpoints.
 *
 * Validates:
 *   resourcesQuerySchema        — GET /api/emergency/resources
 *   nearestResourcesQuerySchema — GET /api/emergency/resources/nearest
 */

import { z } from 'zod';

export const resourcesQuerySchema = z.object({
  type:   z.string().max(100).optional(),
  county: z.string().max(100).optional(),
});

export const nearestResourcesQuerySchema = z.object({
  lat:   z.coerce.number().min(-90).max(90),
  lng:   z.coerce.number().min(-180).max(180),
  type:  z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});
