/**
 * env.ts
 * Validates and exports typed environment configuration using Zod.
 * Called once at startup — if any required var is missing or invalid
 * the process exits with a clear diagnostic message before binding.
 *
 * Required vars: DATABASE_URL, JWT_SECRET, CORS_ORIGINS, PORT, NODE_ENV
 */

import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL:   z.string().optional(),

  /**
   * JWT_SECRET — minimum 32 characters.
   * Used to sign operator session tokens (Phase 2 auth implementation).
   * Set to any 32+ char string in local dev. Use a cryptographically
   * random value in staging/production (openssl rand -hex 32).
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  /**
   * CORS_ORIGINS — comma-separated list of allowed origins.
   * Example: https://dashboard.agency.gov,https://preview.vercel.app
   * In development, localhost origins are always added automatically.
   */
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),

  /**
   * AUTH_ENABLED — feature flag for JWT auth enforcement.
   * 'false' (default): requireAuth/requireRole attach req.user when a valid
   *   token is present but do NOT block unauthenticated requests. Keeps the
   *   existing demo flow working while accounts and dashboard login are wired.
   * 'true': all protected routes require a valid token (and role).
   */
  AUTH_ENABLED: z.enum(['true', 'false']).default('false'),

  /** Token lifetime, e.g. '8h', '30m', '7d'. */
  TOKEN_TTL: z.string().min(1).default('8h'),

  PORT:     z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
});

function loadEnv() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Use process.stderr so it is visible even when stdout is piped
    process.stderr.write(
      `[ENV] Server cannot start — invalid environment configuration:\n${issues}\n`
    );
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
export type Env = typeof env;
