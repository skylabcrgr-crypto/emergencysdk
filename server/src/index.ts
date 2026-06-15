/**
 * index.ts
 * Express server entry point for the Emergency SDK mock backend.
 *
 * Runs on port 3001 by default (configurable via PORT env var).
 * CORS is open to localhost for dashboard development — lock down in production.
 */

import express from 'express';
import cors from 'cors';
import { emergencyRouter } from './routes/emergency.routes';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS: allow dashboard (localhost:5173) and Expo dev client
app.use(
  cors({
    origin: [
      'http://localhost:5173',  // Vite dashboard
      'http://localhost:8081',  // Expo web
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8081',
      /^http:\/\/192\.168\./,   // LAN access from physical device
    ],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));

// ─── Request logger ───────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  console.log(`[ER-API] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/emergency', emergencyRouter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ER Offline SDK — Mock Backend',
    timestamp: new Date().toISOString(),
    note: 'Demo only. No real dispatch integration active.',
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚨 ER Offline SDK — Mock Backend`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Incidents: http://localhost:${PORT}/api/emergency/incidents`);
  console.log(`   Demo only — no real 911 or dispatch integration\n`);
});

export default app;
