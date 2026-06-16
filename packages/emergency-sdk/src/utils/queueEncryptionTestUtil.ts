/**
 * queueEncryptionTestUtil.ts
 * Developer-only manual test utility for the encrypted offline queue.
 *
 * NOT imported in production code. Run via a dev screen or console call.
 *
 * Test sequence:
 *   1. Creates a minimal fake EmergencyPacket.
 *   2. Enqueues it (writes encrypted to AsyncStorage).
 *   3. Reads the raw AsyncStorage value and asserts it is NOT readable JSON.
 *   4. Reads via getQueuedPackets() (decrypted) and confirms the packet is there.
 *   5. Flushes the queue with a mock sendFn.
 *   6. Confirms the queue is now empty.
 *
 * Usage in a dev screen:
 *   import { runQueueEncryptionTest } from '../utils/queueEncryptionTestUtil';
 *   const report = await runQueueEncryptionTest();
 *   console.log(report);
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueuePacket, getQueuedPackets, flushQueue, clearQueue } from '../services/offlineQueueService';
import { isEncryptedPayload } from '../services/encryptionService';
import type { EmergencyPacket } from '../types/emergency.types';

const QUEUE_STORAGE_KEY = '@emergency_sdk/offline_queue';

function makeFakePacket(overrides: Partial<EmergencyPacket> = {}): EmergencyPacket {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    incidentType: 'other',
    latitude: 44.9778,
    longitude: -93.265,
    accuracy: 10,
    altitude: null,
    timestamp: new Date().toISOString(),
    userId: 'test-user',
    deviceId: 'test-device',
    appVersion: '0.0.0-test',
    batteryLevel: 0.8,
    batteryCharging: false,
    batteryState: 'unplugged',
    lowPowerModeEnabled: false,
    staleLocation: false,
    signalStatus: 'strong',
    networkType: 'wifi',
    nearestResource: null,
    additionalNotes: 'Queue encryption test packet — not a real emergency.',
    status: 'queued',
    sentAt: null,
    retryCount: 0,
    pushToken: null,
    ...overrides,
  };
}

export interface QueueEncryptionTestReport {
  passed: boolean;
  steps: { name: string; passed: boolean; detail: string }[];
}

export async function runQueueEncryptionTest(): Promise<QueueEncryptionTestReport> {
  const steps: QueueEncryptionTestReport['steps'] = [];
  let allPassed = true;

  function step(name: string, passed: boolean, detail: string) {
    steps.push({ name, passed, detail });
    if (!passed) allPassed = false;
    const icon = passed ? '✓' : '✗';
    console.log(`  [QueueTest] ${icon} ${name}: ${detail}`);
  }

  console.log('[QueueTest] ── Starting encrypted queue test ──');

  // ── 0. Clean slate ────────────────────────────────────────────────────────
  await clearQueue();
  step('0. Clear queue', true, 'OK');

  // ── 1. Enqueue a fake packet ──────────────────────────────────────────────
  const fake = makeFakePacket();
  try {
    await enqueuePacket(fake);
    step('1. Enqueue packet', true, `Packet ID: ${fake.id}`);
  } catch (err) {
    step('1. Enqueue packet', false, String(err));
  }

  // ── 2. Raw AsyncStorage value should NOT be readable JSON ─────────────────
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (raw === null) {
    step('2. Raw value present', false, 'AsyncStorage key missing after enqueue');
  } else {
    const isEnvelope = isEncryptedPayload(raw);
    step('2. Raw value is EncryptedPayload', isEnvelope,
      isEnvelope
        ? `Stored as encrypted envelope (${raw.length} chars)`
        : `⚠ Stored as plain text: ${raw.slice(0, 80)}…`
    );

    // Also confirm the fake packet ID is NOT visible in the raw string
    const idExposed = raw.includes(fake.id);
    step('2b. Packet ID not visible in raw storage', !idExposed,
      idExposed
        ? '⚠ Packet ID found in raw AsyncStorage value (plaintext leak)'
        : 'Packet ID absent from ciphertext (as expected)'
    );
  }

  // ── 3. Decrypt and confirm packet is present ──────────────────────────────
  try {
    const queue = await getQueuedPackets();
    const found = queue.some((q) => q.packet.id === fake.id);
    step('3. Decrypted queue contains packet', found,
      found ? `Packet ${fake.id} recovered correctly` : 'Packet not found after decrypt'
    );
    step('3b. Queue length', queue.length === 1, `length = ${queue.length} (expected 1)`);
  } catch (err) {
    step('3. Decrypt queue', false, String(err));
  }

  // ── 4. Flush with mock sendFn (always succeeds) ───────────────────────────
  try {
    const result = await flushQueue(async (_packet) => true);
    step('4. Flush queue', result.sent === 1 && result.failed === 0,
      `sent=${result.sent}, failed=${result.failed}`
    );
  } catch (err) {
    step('4. Flush queue', false, String(err));
  }

  // ── 5. Queue should now be empty ──────────────────────────────────────────
  try {
    const finalQueue = await getQueuedPackets();
    step('5. Queue empty after flush', finalQueue.length === 0,
      `length = ${finalQueue.length} (expected 0)`
    );
  } catch (err) {
    step('5. Check empty', false, String(err));
  }

  // ── 6. Enqueue deduplication ──────────────────────────────────────────────
  await enqueuePacket(fake);
  await enqueuePacket(fake); // second enqueue should be ignored
  const dedupQueue = await getQueuedPackets();
  step('6. Deduplication', dedupQueue.length === 1,
    `length = ${dedupQueue.length} after two enqueue calls for same ID (expected 1)`
  );
  await clearQueue();

  console.log(`[QueueTest] ── ${allPassed ? 'ALL PASSED' : 'SOME FAILED'} ──`);
  return { passed: allPassed, steps };
}
