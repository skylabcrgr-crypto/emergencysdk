import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // env.ts validates these at import time — provide safe test values so
    // importing the app/services never calls process.exit(1).
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-000',
      CORS_ORIGINS: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      AUTH_ENABLED: 'true',
      TOKEN_TTL: '1h',
    },
  },
});
