/**
 * rateLimit.ts
 * Tiered express-rate-limit configurations.
 *
 * Tiers:
 *   strictRateLimit          — 10 req / 15 min  — auth routes (future JWT login/refresh)
 *   incidentCreateRateLimit  — 30 req / 15 min  — POST /api/emergency/incidents
 *   dashboardRateLimit       — 200 req / 15 min — GET dashboard + admin read routes
 *
 * Rate-limit headers follow the IETF draft-polli-ratelimit-headers spec
 * (standardHeaders: true). Legacy X-RateLimit-* headers are disabled.
 *
 * In production, set trust proxy so the real client IP is used,
 * not the proxy IP (app.set('trust proxy', 1) in app.ts).
 */

import rateLimit from 'express-rate-limit';

function rateLimitBody(windowMinutes: number) {
  return {
    success:   false,
    error:     `Too many requests — please wait ${windowMinutes} minutes and try again.`,
    timestamp: new Date().toISOString(),
  };
}

/** Strict: 10 requests per 15 minutes. Intended for auth endpoints. */
export const strictRateLimit = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         rateLimitBody(15),
});

/** Moderate: 30 requests per 15 minutes. For incident creation from mobile SDK. */
export const incidentCreateRateLimit = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         rateLimitBody(15),
});

/** Dashboard: 200 requests per 15 minutes. For read-heavy dashboard and admin routes. */
export const dashboardRateLimit = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         rateLimitBody(15),
});
