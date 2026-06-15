/**
 * networkService.ts
 * Monitors connectivity status and makes safe online/offline decisions.
 *
 * Key fix: `isInternetReachable` is `boolean | null`. When null (unresolved),
 * the old `isOnline()` incorrectly treated the device as online. The new
 * `getOnlineDecision()` distinguishes three states:
 *   - 'online'               → connected + reachable confirmed → send
 *   - 'offline'              → no connection or reachable confirmed false → queue
 *   - 'unknown_but_connected'→ connected but reachability unresolved → attempt send,
 *                              queue if send fails (NetInfo #3 race fix)
 *
 * Future integrations:
 * - LoRa mesh: if status === 'offline', check for LoRa gateway advertisement
 * - Satellite: if status === 'offline', attempt Iridium/Starlink session open
 * - RapidSOS fallback: switch API endpoint based on signal quality
 */

import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import type { NetworkState } from '../types/emergency.types';

// ─── Online Decision Layer ────────────────────────────────────────────────────

export type OnlineDecisionStatus =
  | 'online'               // isConnected true + isInternetReachable true
  | 'offline'              // no connection, or internet confirmed unreachable
  | 'unknown_but_connected'; // connected but reachability still resolving (null)

export interface OnlineDecision {
  status: OnlineDecisionStatus;
  /** True if we should attempt a network send (online OR unknown_but_connected). */
  shouldAttemptNetworkSend: boolean;
  reason: string;
  raw: {
    type: NetInfoState['type'];
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  };
}

/**
 * Makes a safe online/offline decision that correctly handles
 * NetInfo's `isInternetReachable === null` race condition on first fetch.
 *
 * Usage in EmergencyButton executeSosFlow:
 *   const decision = await getOnlineDecision();
 *   if (decision.shouldAttemptNetworkSend) {
 *     try { await sendPacketToAPI(...); }
 *     catch { await enqueuePacket(...); }  // unknown_but_connected fallback
 *   } else {
 *     await enqueuePacket(...);
 *   }
 */
export async function getOnlineDecision(): Promise<OnlineDecision> {
  const state = await NetInfo.fetch();

  const raw = {
    type: state.type,
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };

  // Definitely offline: no connection at all, or connection type is 'none'
  if (state.type === 'none' || state.isConnected === false) {
    return {
      status: 'offline',
      shouldAttemptNetworkSend: false,
      reason: 'No active network connection.',
      raw,
    };
  }

  // Connected but internet confirmed unreachable (captive portal, etc.)
  if (state.isConnected === true && state.isInternetReachable === false) {
    return {
      status: 'offline',
      shouldAttemptNetworkSend: false,
      reason: 'Network interface active, but internet is not reachable (captive portal or no route).',
      raw,
    };
  }

  // Connected and internet confirmed reachable
  if (state.isConnected === true && state.isInternetReachable === true) {
    return {
      status: 'online',
      shouldAttemptNetworkSend: true,
      reason: 'Internet reachable.',
      raw,
    };
  }

  // Connected but isInternetReachable is null — NetInfo hasn't finished probing.
  // This is the race condition that caused false queuing on the very first SOS press.
  // Safe decision: attempt send; if it fails, queue. The user gets the best outcome.
  if (state.isConnected === true && state.isInternetReachable === null) {
    return {
      status: 'unknown_but_connected',
      shouldAttemptNetworkSend: true,
      reason:
        'Connected, but internet reachability is still resolving. Attempting send — will queue on failure.',
      raw,
    };
  }

  // Catch-all: unknown state → treat as offline for safety
  return {
    status: 'offline',
    shouldAttemptNetworkSend: false,
    reason: 'Network state unrecognized. Treating as offline for safety.',
    raw,
  };
}

// ─── Legacy / Packet-building Helpers ────────────────────────────────────────
// These are kept for backward compatibility and packet field population.
// They continue to work correctly alongside the new decision layer.

/**
 * Fetches the current network state once (non-reactive).
 * Used by emergencyPacketService for packet.networkType field.
 */
export async function getNetworkState(): Promise<NetworkState> {
  const state: NetInfoState = await NetInfo.fetch();
  return mapNetInfoState(state);
}

/**
 * Subscribes to network state changes.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToNetworkChanges(
  callback: (state: NetworkState) => void
): NetInfoSubscription {
  return NetInfo.addEventListener((state: NetInfoState) => {
    callback(mapNetInfoState(state));
  });
}

/**
 * Returns true if a network send should be attempted.
 * Updated to use `getOnlineDecision()` — resolves the null-reachability race.
 */
export async function isOnline(): Promise<boolean> {
  const decision = await getOnlineDecision();
  return decision.shouldAttemptNetworkSend;
}

/**
 * Determines the SignalStatus string for the emergency packet's signalStatus field.
 *
 * Future: extend with satellite/LoRa detection when those SDKs are integrated.
 */
export async function getSignalStatus(): Promise<
  'strong' | 'weak' | 'offline' | 'satellite' | 'lora'
> {
  const decision = await getOnlineDecision();

  if (decision.status === 'offline') {
    // Future: check for satellite modem — return 'satellite'
    // Future: check for LoRa gateway — return 'lora'
    return 'offline';
  }

  if (decision.raw.type === 'wifi') return 'strong';

  // cellular / unknown_but_connected
  // Future: integrate react-native-device-info for dBm-level signal strength
  return 'weak';
}

// ─── Internal Mapper ──────────────────────────────────────────────────────────

function mapNetInfoState(state: NetInfoState): NetworkState {
  return {
    isConnected: state.isConnected ?? false,
    type: state.type ?? 'unknown',
    isInternetReachable: state.isInternetReachable,
  };
}
