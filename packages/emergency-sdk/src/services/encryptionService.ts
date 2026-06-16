/// <reference lib="dom" />
/**
 * encryptionService.ts
 * AES-256-GCM encrypt/decrypt for emergency packet queue items.
 *
 * Cipher choice: AES-GCM
 *   - Authenticated encryption — prevents ciphertext tampering (AEAD).
 *   - 128-bit authentication tag — any bit flip causes decrypt to throw.
 *   - 96-bit (12-byte) IV per encryption — safe for ~2^32 messages per key
 *     before IV collision risk (far exceeds any realistic device queue).
 *   - Hardware-accelerated on modern ARMv8+ chips (AES-NI equivalent).
 *   - Available via Hermes Web Crypto API in React Native ≥ 0.71.
 *
 * Envelope format (stored as a JSON string):
 *   { v: 1, iv: "<base64 12 bytes>", ct: "<base64 ciphertext + 16-byte tag>" }
 *
 * ─── Production TODOs ────────────────────────────────────────────────────────
 *
 * TODO(production/kdf): Add a PBKDF2 or HKDF step if additional key
 *   diversification per-user or per-session is required. Current model uses
 *   the raw device key directly — acceptable for local-only storage but
 *   consider deriving sub-keys if the same device key is reused across
 *   multiple users on a shared device.
 *
 * TODO(production/additional-data): Pass `serverIncidentId` or `packetId`
 *   as the `additionalData` parameter to AES-GCM to bind the ciphertext
 *   to a specific record and prevent cut-and-paste ciphertext reuse:
 *     crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: ... }, key, data)
 *
 * TODO(production/v2-migration): When bumping the envelope version (v: 2),
 *   update decryptString() to branch on payload.v and route to the
 *   appropriate decrypt path. Keep the v1 decrypt path until all items
 *   have been migrated.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getDeviceEncryptionKey } from './secureStorageService';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Serialized encrypted envelope persisted to AsyncStorage.
 * All fields are base64-encoded binary.
 */
export interface EncryptedPayload {
  /** Envelope version — increment on breaking changes to cipher/format. */
  v: 1;
  /** AES-GCM initialization vector (96 bits / 12 bytes). */
  iv: string;
  /** AES-GCM ciphertext + authentication tag (last 16 bytes). */
  ct: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM with the device key.
 * Returns a JSON string (EncryptedPayload) suitable for storage in AsyncStorage.
 *
 * Generates a fresh random 96-bit IV for every call.
 */
export async function encryptString(plaintext: string): Promise<string> {
  const key = await getDeviceEncryptionKey();

  // Fresh random IV per encryption — NEVER reuse an IV with the same key.
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoded
  );

  const payload: EncryptedPayload = {
    v: 1,
    iv: uint8ToBase64(iv),
    ct: uint8ToBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypts a JSON string (EncryptedPayload) produced by encryptString().
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export async function decryptString(encryptedJson: string): Promise<string> {
  const payload = JSON.parse(encryptedJson) as EncryptedPayload;

  if (payload.v !== 1) {
    throw new Error(`encryptionService: unsupported envelope version ${payload.v}`);
  }

  const key = await getDeviceEncryptionKey();
  const iv  = base64ToUint8(payload.iv).buffer as ArrayBuffer;
  const ct  = base64ToUint8(payload.ct).buffer as ArrayBuffer;

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Returns true if `value` looks like an EncryptedPayload envelope.
 * Used by the migration path in offlineQueueService to detect unencrypted
 * legacy queue items and migrate them on first read.
 */
export function isEncryptedPayload(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Record<string, unknown>).v === 1 &&
      typeof (parsed as Record<string, unknown>).iv === 'string' &&
      typeof (parsed as Record<string, unknown>).ct === 'string'
    );
  } catch {
    return false;
  }
}
