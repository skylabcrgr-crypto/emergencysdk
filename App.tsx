/**
 * App.tsx
 * Root entry point.
 *
 * Responsibilities:
 * 1. Mounts the demo screen.
 * 2. Flushes any offline-queued packets on three triggers:
 *    - App mount (handles force-kill + relaunch recovery)
 *    - Network reconnection (NetInfo subscriber)
 *    - App foreground return (AppState subscriber)
 *
 * The `flushingRef` guard prevents concurrent flush calls from stacking
 * if multiple triggers fire close together (e.g. mount + netinfo together).
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';

import { EmergencyDemoScreen } from './src/screens/EmergencyDemoScreen';
import { flushQueue } from './src/emergency/services/offlineQueueService';
import { sendPacketToAPI } from './src/emergency/services/emergencyPacketService';
import { getOnlineDecision } from './src/emergency/services/networkService';

export default function App() {
  const mountedRef = useRef(true);
  const flushingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // ── Safe flush helper ─────────────────────────────────────────────────
    const safeFlush = async (reason: string) => {
      if (flushingRef.current || !mountedRef.current) return;
      flushingRef.current = true;

      try {
        const decision = await getOnlineDecision();
        if (!decision.shouldAttemptNetworkSend) {
          console.log(
            `[EmergencySDK] Queue flush skipped (${reason}): ${decision.reason}`
          );
          return;
        }

        console.log(`[EmergencySDK] Flushing offline queue — reason: ${reason}`);

        const { sent, failed } = await flushQueue((packet) =>
          sendPacketToAPI(packet).then(() => true).catch(() => false)
        );

        if (sent > 0 || failed > 0) {
          console.log(
            `[EmergencySDK] Queue flush complete — sent: ${sent}, failed: ${failed}`
          );
        }
      } catch (err) {
        console.warn('[EmergencySDK] Queue flush error:', err);
      } finally {
        flushingRef.current = false;
      }
    };

    // Trigger 1: flush on mount (recovers from force-kill)
    void safeFlush('app_mount');

    // Trigger 2: flush when network reconnects
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const likelySendable =
        state.isConnected === true && state.isInternetReachable !== false;
      if (likelySendable) {
        void safeFlush('network_reconnected');
      }
    });

    // Trigger 3: flush when app returns to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void safeFlush('app_foregrounded');
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribeNetInfo();
      appStateSub.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="#0D0D0D" />
      <EmergencyDemoScreen />
    </>
  );
}
