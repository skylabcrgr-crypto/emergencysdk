/**
 * incident.schema.ts
 * Zod schemas for emergency incident endpoints.
 *
 * Validates and sanitizes:
 *   createIncidentSchema  — POST /api/emergency/incidents body
 *   updateStatusSchema    — PATCH /api/emergency/incidents/:id/status body
 *   incidentQuerySchema   — GET /api/emergency/incidents query params
 *
 * Operator notes are sanitized: HTML stripped, whitespace normalized, max 500 chars.
 */

import { z } from 'zod';
import crypto from 'crypto';
import type { IncidentStatus } from '../types';
import { INCIDENT_STATUS_ORDER } from '../types';

/** Strip HTML tags and normalize whitespace in free-text fields. */
function sanitizeText(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')      // strip HTML tags
    .replace(/&[a-z#0-9]+;/gi, ' ') // strip HTML entities
    .replace(/\s+/g, ' ')         // normalize whitespace
    .trim()
    .slice(0, 500);
}

const STATUS_TUPLE = INCIDENT_STATUS_ORDER as [IncidentStatus, ...IncidentStatus[]];
export const incidentStatusEnum = z.enum(STATUS_TUPLE);

const nearestResourceSchema = z.object({
  id:            z.string().max(200),
  name:          z.string().max(200),
  type:          z.string().max(100),
  phone:         z.string().max(30),
  county:        z.string().max(100),
  latitude:      z.number().min(-90).max(90),
  longitude:     z.number().min(-180).max(180),
  address:       z.string().max(500).optional(),
  distanceMiles: z.number().nonnegative(),
}).strict();

export const createIncidentSchema = z.object({
  id:                  z.string().uuid().optional().default(() => crypto.randomUUID()),
  incidentType:        z.string().min(1).max(100),
  latitude:            z.number().min(-90).max(90),
  longitude:           z.number().min(-180).max(180),
  accuracy:            z.number().nonnegative().optional().default(0),
  altitude:            z.number().nullable().optional().default(null),
  timestamp:           z.string().max(50).optional().default(() => new Date().toISOString()),
  userId:              z.string().max(200).optional().default(''),
  deviceId:            z.string().max(200).optional().default(''),
  appVersion:          z.string().max(50).optional().default(''),
  batteryLevel:        z.number().min(0).max(1).nullable().optional().default(null),
  batteryCharging:     z.boolean().nullable().optional().default(null),
  batteryState:        z.string().max(50).optional(),
  lowPowerModeEnabled: z.boolean().nullable().optional(),
  staleLocation:       z.boolean().optional(),
  signalStatus:        z.string().max(50).optional().default('unknown'),
  networkType:         z.string().max(50).optional().default('unknown'),
  nearestResource:     nearestResourceSchema.nullable().optional().default(null),
  additionalNotes:     z.string().max(500).optional().default('')
    .transform(s => sanitizeText(s)),
  status:              z.string().max(50).optional().default('queued'),
  sentAt:              z.string().max(50).nullable().optional().default(null),
  retryCount:          z.number().int().nonnegative().optional().default(0),
  pushToken:           z.string().max(300).nullable().optional(),
});

export const updateStatusSchema = z.object({
  status:       incidentStatusEnum,
  operatorNote: z.string().max(500).optional()
    .transform(s => s !== undefined ? sanitizeText(s) : s),
  operatorId:   z.string().max(200).optional(),
});

export const incidentQuerySchema = z.object({
  status: z.string().max(200).optional(),
  type:   z.string().max(200).optional(),
});

export const noteSchema = z.object({
  note:       z.string().min(1).max(500).transform(s => sanitizeText(s)),
  operatorId: z.string().max(200).optional(),
});

export const assignmentSchema = z.object({
  assignedTo:   z.string().max(200).optional(),
  assignedUnit: z.string().max(200).optional(),
  operatorId:   z.string().max(200).optional(),
});
