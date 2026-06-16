/**
 * app.ts
 * Express application factory — no server.listen() call here.
 *
 * Imported by:
 *   - server/src/index.ts  (local dev — calls app.listen())
 *   - api/index.ts          (Vercel serverless — exports as default handler)
 *
 * Security posture:
 *   - Helmet sets secure HTTP headers
 *   - CORS locked to CORS_ORIGINS env var (+ localhost in development)
 *   - Tiered rate limiting per route tier (see middleware/rateLimit.ts)
 *   - Structured JSON request logger with per-request UUID
 *   - Central error handler — no stack traces in staging/production
 *   - All request bodies / query params validated with Zod (in route files)
 *   - Env vars validated at startup (see config/env.ts)
 */

// ⚠ Import env FIRST — validates all required vars before anything else binds.
import './config/env';
import { env } from './config/env';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import {
  incidentCreateRateLimit,
  dashboardRateLimit,
  strictRateLimit,
} from './middleware/rateLimit';

import { emergencyRouter } from './routes/emergency.routes';
import { adminRouter }     from './routes/admin.routes';

const app = express();

// ─── Trust proxy (Vercel / Railway / reverse proxies) ─────────────────────────
// Required so express-rate-limit uses the real client IP via X-Forwarded-For.
app.set('trust proxy', 1);

// ─── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production: locked to CORS_ORIGINS env var (comma-separated list).
// In development: also allows localhost:5173 / localhost:8081 for local tooling.

const configuredOrigins: (string | RegExp)[] = env.CORS_ORIGINS
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (env.NODE_ENV === 'development') {
  configuredOrigins.push(
    'http://localhost:5173',
    'http://localhost:8081',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8081',
    /^http:\/\/192\.168\./,  // LAN — physical device on same Wi-Fi
  );
}

app.use(
  cors({
    origin:         configuredOrigins,
    methods:        ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-operator-role', 'x-request-id'],
  })
);

// ─── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));

// ─── Structured request logger ────────────────────────────────────────────────
app.use(requestLogger);

// ─── Health check (no rate limit — used by load balancer probes) ──────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'ER Offline SDK Backend',
    env:       env.NODE_ENV,
    timestamp: new Date().toISOString(),
    note:      'Pre-pilot system. No real dispatch integration active.',
  });
});

// ─── Routes with tiered rate limiting ─────────────────────────────────────────

// Mobile SDK incident ingestion — moderate rate limit
app.use('/api/emergency', incidentCreateRateLimit, emergencyRouter);

// Dashboard / admin — read-heavy, generous but bounded
app.use('/api/admin', dashboardRateLimit, adminRouter);

// Auth routes (future JWT login/refresh) — strict
// app.use('/api/auth', strictRateLimit, authRouter);
void strictRateLimit; // suppress unused-import lint until auth routes are wired

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Central error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

export default app;
