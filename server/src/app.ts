/**
 * app.ts
 * Express application factory — no server.listen() call here.
 *
 * Imported by:
 *   - server/src/index.ts  (local dev — calls app.listen())
 *   - api/index.ts          (Vercel serverless — exports as default handler)
 */

import express from 'express';
import cors from 'cors';
import { emergencyRouter } from './routes/emergency.routes';

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow dashboard (local dev + Vercel) and Expo dev client / mobile SDK.
// React Native fetch is not subject to browser CORS enforcement, but we keep
// this explicit for any web-based integrations.

app.use(
  cors({
    origin: [
      'http://localhost:5173',       // Vite dashboard (local dev)
      'http://localhost:8081',       // Expo web (local dev)
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8081',
      /^http:\/\/192\.168\./,        // LAN — physical device on same network
      /^https:\/\/.*\.vercel\.app$/, // Vercel preview + production deployments
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

export default app;
