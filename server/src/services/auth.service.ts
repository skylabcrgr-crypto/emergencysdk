/**
 * auth.service.ts
 * Core authentication primitives: password hashing and JWT sign/verify.
 *
 * Kept free of Express/DB types so it can be unit-tested in isolation.
 * Token claims are intentionally minimal: { sub: userId, role }.
 */

import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

const BCRYPT_ROUNDS = 12;

export type UserRole = 'mobile' | 'operator' | 'admin' | 'viewer';

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
