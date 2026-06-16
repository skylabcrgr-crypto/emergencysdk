/**
 * auth.middleware.test.ts
 * Route-level tests for requireAuth / requireRole using supertest.
 * The audit service is mocked so no database is touched.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the audit service so middleware never touches Prisma/DB.
vi.mock('../src/services/audit.service', () => ({
  logAuditEvent: vi.fn(),
}));

import { requireAuth, requireRole } from '../src/middleware/auth.middleware';
import { signToken } from '../src/services/auth.service';
import { env } from '../src/config/env';

function makeApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ user: req.user ?? null });
  });
  app.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('auth enforcement (AUTH_ENABLED=true)', () => {
  const app = makeApp();
  let prev: string;

  beforeAll(() => {
    prev = env.AUTH_ENABLED;
    env.AUTH_ENABLED = 'true';
  });
  afterAll(() => {
    env.AUTH_ENABLED = prev as 'true' | 'false';
  });

  it('rejects requests with no token (401)', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token (401)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer garbage.token.value');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and attaches req.user (200)', async () => {
    const token = signToken('user-1', 'operator');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ userId: 'user-1', role: 'operator' });
  });

  it('rejects insufficient role on an admin route (403)', async () => {
    const token = signToken('user-2', 'operator');
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows the correct role on an admin route (200)', async () => {
    const token = signToken('user-3', 'admin');
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('permissive mode (AUTH_ENABLED=false)', () => {
  const app = makeApp();
  let prev: string;

  beforeAll(() => {
    prev = env.AUTH_ENABLED;
    env.AUTH_ENABLED = 'false';
  });
  afterAll(() => {
    env.AUTH_ENABLED = prev as 'true' | 'false';
  });

  it('passes through requests with no token (200)', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('still attaches req.user when a valid token is present', async () => {
    const token = signToken('user-9', 'admin');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ userId: 'user-9', role: 'admin' });
  });

  it('does not block an admin route for unauthenticated requests', async () => {
    const res = await request(app).get('/admin-only');
    expect(res.status).toBe(200);
  });
});
