/**
 * auth.service.test.ts
 * Unit tests for password hashing and JWT primitives. No DB required.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  extractBearerToken,
} from '../src/services/auth.service';

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('S3cret!pw');
    expect(hash).not.toBe('S3cret!pw');
    expect(await verifyPassword('S3cret!pw', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('S3cret!pw');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('returns false for an empty hash', async () => {
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});

describe('JWT sign/verify', () => {
  it('signs and verifies a token with correct claims', () => {
    const token = signToken('user-123', 'operator');
    const claims = verifyToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe('user-123');
    expect(claims?.role).toBe('operator');
  });

  it('returns null for a tampered token', () => {
    const token = signToken('user-123', 'admin');
    expect(verifyToken(token + 'tampered')).toBeNull();
  });

  it('returns null for null / empty input', () => {
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
    expect(verifyToken('')).toBeNull();
  });

  it('returns null for a garbage string', () => {
    expect(verifyToken('not.a.jwt')).toBeNull();
  });
});

describe('extractBearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
  });

  it('returns null for non-Bearer or missing headers', () => {
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
  });
});
