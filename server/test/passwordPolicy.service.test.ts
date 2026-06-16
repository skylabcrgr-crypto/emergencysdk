/**
 * passwordPolicy.service.test.ts
 * Unit tests for password strength validation. No DB required.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePasswordStrength,
  PASSWORD_MIN_LENGTH,
} from '../src/services/passwordPolicy.service';

describe('validatePasswordStrength', () => {
  it('accepts a strong password meeting all rules', () => {
    const res = validatePasswordStrength('Str0ng!Passphrase9');
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.score).toBeGreaterThanOrEqual(4);
  });

  it(`rejects passwords shorter than ${PASSWORD_MIN_LENGTH} chars`, () => {
    const res = validatePasswordStrength('Ab1!xyz');
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(new RegExp(`${PASSWORD_MIN_LENGTH}`));
  });

  it('requires an uppercase letter', () => {
    const res = validatePasswordStrength('str0ng!passphrase9');
    expect(res.valid).toBe(false);
  });

  it('requires a lowercase letter', () => {
    const res = validatePasswordStrength('STR0NG!PASSPHRASE9');
    expect(res.valid).toBe(false);
  });

  it('requires a number', () => {
    const res = validatePasswordStrength('Strong!Passphrase');
    expect(res.valid).toBe(false);
  });

  it('requires a symbol', () => {
    const res = validatePasswordStrength('Strong1Passphrase9');
    expect(res.valid).toBe(false);
  });

  it('rejects common weak passwords', () => {
    expect(validatePasswordStrength('Password123!aaa').valid).toBe(false);
    expect(validatePasswordStrength('emergencyAdmin1!').valid).toBe(false);
  });

  it('rejects a password containing the email local part', () => {
    const res = validatePasswordStrength('Jsmith!Secret99', 'jsmith');
    expect(res.valid).toBe(false);
  });

  it('rejects long runs of a repeated character', () => {
    const res = validatePasswordStrength('Aaaaaaa1!aaaaaa');
    expect(res.valid).toBe(false);
  });
});
