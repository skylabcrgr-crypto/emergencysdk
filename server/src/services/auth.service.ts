/**
 * auth.service.ts
 * Core authentication primitives: password hashing and JWT sign/verify.
 *
 * Kept free of Express/DB types so it can be unit-tested in isolation.
 * Token claims are intentionally minimal: { sub: userId, role }.
 */

import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

const BCRYPT_ROUNDS = 12;

export type UserRole = 'mobile' | 'operator' | 'admin' | 'viewer' | 'agency_partner';

export interface TokenClaims {
  /** Subject — the User.id */
  sub: string;
  role: UserRole;
}

// ─── Password hashing ───────────────────────────────────────────────────────

/** Hash a plaintext password with bcrypt. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Constant-time compare of a plaintext password against a bcrypt hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// ─── JWT ────────────────────────────────────────────────────────────────────

/** Sign a JWT for the given user id and role. */
export function signToken(userId: string, role: UserRole): string {
  const claims: TokenClaims = { sub: userId, role };
  const options: SignOptions = { expiresIn: env.TOKEN_TTL as SignOptions['expiresIn'] };
  return jwt.sign(claims, env.JWT_SECRET, options);
}

/**
 * Verify and decode a JWT.
 * Returns the claims on success, or null if the token is missing,
 * malformed, tampered, or expired.
 */
export function verifyToken(token: string | undefined | null): TokenClaims | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof (decoded as Record<string, unknown>).sub === 'string' &&
      typeof (decoded as Record<string, unknown>).role === 'string'
    ) {
      return { sub: decoded.sub as string, role: (decoded as { role: UserRole }).role };
    }
    return null;
  } catch {
    return null;
  }
}

/** Extract a Bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}

// ─── Single-use tokens (password reset / invites) ─────────────────────────────

/**
 * Generate a cryptographically random URL-safe token plus its SHA-256 hash.
 * The raw token is emailed to the user; only the hash is persisted.
 */
export function generateSecureToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

/** SHA-256 hex hash of a raw token, for lookup without storing the raw value. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a strong, human-copyable temporary password that satisfies the
 * password policy (upper, lower, digit, symbol, length >= 14).
 */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digit = '23456789';
  const symbol = '!@#$%^&*?-_';
  const all = upper + lower + digit + symbol;

  const pick = (set: string): string => set[crypto.randomInt(0, set.length)];

  // Guarantee one of each required class, then fill to length 16.
  const chars = [pick(upper), pick(lower), pick(digit), pick(symbol)];
  while (chars.length < 16) chars.push(pick(all));

  // Fisher–Yates shuffle using crypto randomness.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
