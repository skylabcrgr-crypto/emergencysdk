/**
 * tokenHelpers.test.ts
 * Unit tests for secure token + temporary password generation. No DB required.
 */

import { describe, it, expect } from 'vitest';
import {
  generateSecureToken,
  hashToken,
  generateTemporaryPassword,
} from '../src/services/auth.service';
import { validatePasswordStrength } from '../src/services/passwordPolicy.service';

describe('generateSecureToken', () => {
  it('returns a token and its matching SHA-256 hash', () => {
    const { token, tokenHash } = generateSecureToken();
    expect(token.length).toBeGreaterThan(20);
    expect(tokenHash).toBe(hashToken(token));
    // 64 hex chars for SHA-256
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces unique tokens', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('generateTemporaryPassword', () => {
  it('generates a password that satisfies the password policy', () => {
    for (let i = 0; i < 25; i++) {
      const pw = generateTemporaryPassword();
      const res = validatePasswordStrength(pw);
      expect(res.valid).toBe(true);
    }
  });

  it('generates unique passwords', () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});
