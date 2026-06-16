/**
 * index.ts
 * Local development entry point.
 * Imports the Express app from app.ts and starts the HTTP server.
 *
 * For Vercel serverless deployment, see /api/index.ts instead.
 */

import app from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.listen(PORT, () => {
  console.log(`\n🚨 ER Offline SDK — Mock Backend`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Incidents: http://localhost:${PORT}/api/emergency/incidents`);
  console.log(`   Demo only — no real 911 or dispatch integration\n`);
});

export default app;

