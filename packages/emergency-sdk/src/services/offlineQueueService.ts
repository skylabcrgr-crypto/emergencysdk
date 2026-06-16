/**
 * offlineQueueService.ts
 * Persists unsent emergency packets to AsyncStorage and retries when online.
 *
 * Storage layout:
 *   EMERGENCY_QUEUE → single AES-256-GCM encrypted EncryptedPayload envelope
 *                     (JSON string from encryptionService.encryptString).
 *                     The plaintext inside the envelope is a JSON array of
 *                     QueuedPacket.
 *
 * Backward-compatibility migration:
 *   If the stored value is NOT an EncryptedPayload (i.e. a legacy plain-JSON
 *   queue from a previous app version), getQueuedPackets() reads and migrates
 *   it to encrypted format transparently on first access.
 *
 * Future integrations:
 * - SQLite: swap AsyncStorage for expo-sqlite for larger queue capacity
 * - Background fetch: use expo-background-fetch to retry queue even when
 *   app is backgrounded (requires additional Expo config)
 * - Conflict resolution: if RapidSOS/CAD returns a server-assigned incidentId
 *   on ACK, update the stored packet status to 'acknowledged'
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmergencyPacket, QueuedPacket } from '../types/emergency.types';
import { encryptString, decryptString, isEncryptedPayload } from './encryptionService';

const QUEUE_STORAGE_KEY = '@emergency_sdk/offline_queue';
const MAX_RETRY_ATTEMPTS = 5;

// ─── Core Queue Operations ────────────────────────────────────────────────────

/**
 * Adds an emergency packet to the offline queue.
 * Safe to call multiple times — deduplicates by packet ID.
 */
export async function enqueuePacket(packet: EmergencyPacket): Promise<void> {
  const queue = await getQueuedPackets();

  // Deduplicate: skip if already queued
  const exists = queue.some((q) => q.packet.id === packet.id);
  if (exists) return;

  const queuedPacket: QueuedPacket = {
    packet: { ...packet, status: 'queued' },
    queuedAt: new Date().toISOString(),
    attemptCount: 0,
  };

  queue.push(queuedPacket);
  await persistQueue(queue);
}

/**
 * Returns all currently queued packets in insertion order.
 *
 * Handles three storage states transparently:
 *   1. Empty / absent  → returns []
 *   2. EncryptedPayload (current format) → decrypts and parses
 *   3. Plain JSON array (legacy unencrypted) → migrates to encrypted and returns
 */
export async function getQueuedPackets(): Promise<QueuedPacket[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];

    // ── Backward-compatibility migration ─────────────────────────────────────
    // If the stored string is NOT an EncryptedPayload, it is a legacy plain-JSON
    // queue from an older version of the app. Read it, re-encrypt, and save.
    if (!isEncryptedPayload(raw)) {
      console.warn('[offlineQueue] Migrating plain-JSON queue to encrypted format.');
      let legacyQueue: QueuedPacket[] = [];
      try {
        legacyQueue = JSON.parse(raw) as QueuedPacket[];
      } catch {
        // Corrupt legacy data — discard and start fresh.
        await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
        return [];
      }
      await persistQueue(legacyQueue);          // write back encrypted
      return legacyQueue;
    }

    // ── Normal path: decrypt and parse ───────────────────────────────────────
    const plaintext = await decryptString(raw);
    return JSON.parse(plaintext) as QueuedPacket[];
  } catch (err) {
    // Decryption failure (e.g. key was wiped, device restore without backup)
    // — discard the queue rather than crashing the SOS flow.
    console.error('[offlineQueue] Failed to read/decrypt queue; discarding:', err);
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY).catch(() => {});
    return [];
  }
}

/**
 * Removes a successfully synced packet from the queue by its ID.
 */
export async function removeFromQueue(packetId: string): Promise<void> {
  const queue = await getQueuedPackets();
  const updated = queue.filter((q) => q.packet.id !== packetId);
  await persistQueue(updated);
}

/**
 * Increments the attempt count for a packet.
 * If max retries exceeded, marks it as 'failed' in the queue.
 */
export async function incrementAttemptCount(packetId: string): Promise<void> {
  const queue = await getQueuedPackets();

  const updated = queue.map((q) => {
    if (q.packet.id !== packetId) return q;
    const newCount = q.attemptCount + 1;
    return {
      ...q,
      attemptCount: newCount,
      packet: {
        ...q.packet,
        retryCount: newCount,
        status:
          newCount >= MAX_RETRY_ATTEMPTS
            ? ('failed' as const)
            : q.packet.status,
      },
    };
  });

  await persistQueue(updated);
}

/**
 * Returns only the packets that are eligible for retry:
 * - status === 'queued'
 * - attemptCount < MAX_RETRY_ATTEMPTS
 */
export async function getRetryablePackets(): Promise<QueuedPacket[]> {
  const queue = await getQueuedPackets();
  return queue.filter(
    (q) =>
      q.packet.status === 'queued' && q.attemptCount < MAX_RETRY_ATTEMPTS
  );
}

/**
 * Returns the total number of queued packets.
 */
export async function getQueueCount(): Promise<number> {
  const queue = await getQueuedPackets();
  return queue.length;
}

/**
 * Clears the entire queue. Use with caution — only after confirmed full sync.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}

// ─── Auto-Sync Trigger ────────────────────────────────────────────────────────

/**
 * Attempts to flush the offline queue when internet connectivity returns.
 * Pass a `sendFn` that attempts to transmit a single packet; it should
 * return true on success, false on failure.
 *
 * Wire this up to the network subscriber in networkService:
 *   subscribeToNetworkChanges(async (state) => {
 *     if (state.isConnected) await flushQueue(myApiSendFunction);
 *   });
 *
 * Future: replace sendFn with RapidSOS PULSE API call, CAD POST, or
 * NG911 SIP INVITE depending on the configured dispatch mode.
 */
export async function flushQueue(
  sendFn: (packet: EmergencyPacket) => Promise<boolean>
): Promise<{ sent: number; failed: number }> {
  const retryable = await getRetryablePackets();

  let sent = 0;
  let failed = 0;

  for (const queued of retryable) {
    const success = await sendFn(queued.packet);
    if (success) {
      await removeFromQueue(queued.packet.id);
      sent++;
    } else {
      await incrementAttemptCount(queued.packet.id);
      failed++;
    }
  }

  return { sent, failed };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Serializes the queue to JSON, encrypts it, and writes the EncryptedPayload
 * envelope to AsyncStorage. The stored value is never readable plain JSON.
 */
async function persistQueue(queue: QueuedPacket[]): Promise<void> {
  const plaintext = JSON.stringify(queue);
  const encrypted = await encryptString(plaintext);
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, encrypted);
}
