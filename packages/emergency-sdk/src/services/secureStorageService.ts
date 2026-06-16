/// <reference lib="dom" />
/**
 * secureStorageService.ts
 * Manages the per-device AES-256-GCM encryption key used to protect the
 * offline emergency packet queue stored in AsyncStorage.
 *
 * Key storage strategy:
 *   - The key is generated once per device via the Web Crypto API (Hermes).
 *   - It is exported as raw bytes, base64-encoded, and persisted in
 *     expo-secure-store (iOS Keychain / Android Keystore).
 *   - On subsequent app launches the key is imported from SecureStore —
 *     no regeneration needed.
 *
 * ─── Production TODOs ────────────────────────────────────────────────────────
 *
 * TODO(production/key-rotation): Implement key rotation with a versioned key
 *   alias (e.g. er_sdk_offline_queue_key_v2). On rotation:
 *     1. Generate new key and store under v2 alias.
 *     2. Re-encrypt all existing queue items with the new key.
 *     3. Delete the v1 key from SecureStore.
 *   Include a migration timestamp and key version in the EncryptedPayload
 *   envelope so old items can be migrated lazily on read.
 *
 * TODO(production/secure-enclave): On iOS A12+ devices expo-secure-store backs
 *   the Keychain with the Secure Enclave, making the key unexportable at the
 *   hardware level. To take full advantage, generate the key as non-extractable
 *   (extractable: false) and keep it in the Keychain rather than exporting to
 *   AsyncStorage. This requires a native module that wraps CryptoKit
 *   (ChaChaPoly / AES-GCM with SEP-backed key) — not yet available in Expo SDK.
 *   Track: https://github.com/expo/expo/issues (search "SecureEnclave CryptoKit").
 *
 * TODO(production/android-strongbox): On Android devices with StrongBox HSM,
 *   expo-secure-store uses EncryptedSharedPreferences backed by Android Keystore.
 *   For full HSM binding use the Android KeyStore API directly via a Turbo Module.
 *   Keys generated there are non-exportable and hardware-attested.
 *
 * TODO(production/mdm): Enterprise MDM policies (Jamf / Intune / VMware WS1)
 *   can restrict which apps have Keychain / Keystore access, enforce minimum
 *   key rotation intervals, and remote-wipe keys on device disenrollment.
 *   Wire into your MDM enrollment flow and respect the MANAGED_APP_CONFIG
 *   key rotation policy if present in NSUbiquitousKeyValueStore / Android
 *   ManagedRestrictions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as SecureStore from 'expo-secure-store';

// Versioned alias so future key rotations can use a new key without
// invalidating the current key while migration runs.
const DEVICE_KEY_ALIAS = 'er_sdk_offline_queue_key_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(rawKey);
  let b64 = '';
  bytes.forEach((b) => { b64 += String.fromCharCode(b); });
  return btoa(b64);
}

async function importKeyFromBase64(b64: string): Promise<CryptoKey> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    'raw', bytes,
    { name: 'AES-GCM', length: 256 },
    true,                            // extractable — needed to export for SecureStore
    ['encrypt', 'decrypt']
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns (or creates) the per-device AES-256-GCM key.
 * The key is cached in SecureStore after first generation so it survives
 * app restarts and updates.
 */
export async function getDeviceEncryptionKey(): Promise<CryptoKey> {
  const stored = await SecureStore.getItemAsync(DEVICE_KEY_ALIAS);
  if (stored) {
    return importKeyFromBase64(stored);
  }

  // First run — generate and persist
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await exportKeyToBase64(key);
  await SecureStore.setItemAsync(DEVICE_KEY_ALIAS, exported);
  return key;
}

/**
 * Deletes the stored key from SecureStore.
 * After calling this, getDeviceEncryptionKey() will generate a new key on
 * next call — any previously encrypted data will be permanently unreadable.
 *
 * Only call from a full device-wipe / account-reset flow.
 */
export async function deleteDeviceEncryptionKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_KEY_ALIAS);
}

/**
 * Returns true if a device key has been persisted in SecureStore.
 * Useful for diagnostics / first-run detection.
 */
export async function hasDeviceEncryptionKey(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(DEVICE_KEY_ALIAS);
  return val !== null;
}
