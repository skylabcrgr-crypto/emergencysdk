/**
 * api/index.ts
 * Vercel serverless entry point for the Emergency SDK backend.
 *
 * Vercel's @vercel/node runtime exports this as an HTTP handler.
 * The Express app handles all routing internally.
 *
 * All requests matching /api/* are rewritten here via vercel.json.
 * Local development still uses server/src/index.ts (npm run dev in /server).
 */

import app from '../server/src/app';

export default app;
