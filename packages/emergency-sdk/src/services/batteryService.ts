/**
 * batteryService.ts
 * Reads device battery level, charge state, and low-power mode.
 *
 * Returns a BatterySnapshot used to enrich every EmergencyPacket so
 * operators know if a device in the field is about to die.
 *
 * expo-battery supports: iOS, Android, web (limited — level only).
 * All calls are wrapped in try/catch; a null snapshot is always safe.
 *
 * Future integrations:
 * - Low battery alert: if batteryLevelPercent < 15, add urgency flag to packet
 * - Background battery monitoring: expo-battery's addBatteryLevelListener
 *   can trigger an automatic SOS queue flush before device powers off
 */

import * as Battery from 'expo-battery';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BatteryStateLabel =
  | 'unknown'
  | 'unplugged'
  | 'charging'
  | 'full';

export interface BatterySnapshot {
  /** Raw level from expo-battery (0.0–1.0). Used in EmergencyPacket.batteryLevel. */
  level: number | null;
  /** Human-friendly 0–100 integer for display. */
  levelPercent: number | null;
  /** Normalized charge state string. */
  batteryState: BatteryStateLabel;
  /** True if charging OR fully charged. Used for EmergencyPacket.batteryCharging. */
  isCharging: boolean | null;
  /** Low Power Mode (iOS) / Battery Saver (Android). null if unavailable. */
  lowPowerModeEnabled: boolean | null;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeBatteryState(state: Battery.BatteryState): BatteryStateLabel {
  switch (state) {
    case Battery.BatteryState.UNPLUGGED: return 'unplugged';
    case Battery.BatteryState.CHARGING:  return 'charging';
    case Battery.BatteryState.FULL:      return 'full';
    case Battery.BatteryState.UNKNOWN:
    default:                             return 'unknown';
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Reads all available battery info in a single concurrent fetch.
 * Always resolves — never rejects. Returns nulls on any platform failure.
 *
 * expo-battery docs: https://docs.expo.dev/versions/latest/sdk/battery/
 */
export async function getBatterySnapshot(): Promise<BatterySnapshot> {
  try {
    const [level, state, lowPowerMode] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
      Battery.isLowPowerModeEnabledAsync().catch(() => null),
    ]);

    const batteryState = normalizeBatteryState(state);
    const validLevel = level >= 0 ? level : null;

    return {
      level: validLevel,
      levelPercent: validLevel !== null ? Math.round(validLevel * 100) : null,
      batteryState,
      isCharging: batteryState === 'charging' || batteryState === 'full',
      lowPowerModeEnabled: lowPowerMode,
    };
  } catch (error) {
    console.warn('[EmergencySDK] Battery snapshot unavailable:', error);
    return {
      level: null,
      levelPercent: null,
      batteryState: 'unknown',
      isCharging: null,
      lowPowerModeEnabled: null,
    };
  }
}
