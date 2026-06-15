/**
 * EmergencyButton.tsx
 * Primary SOS trigger button with animated state feedback.
 *
 * State machine:
 *   idle → requesting_location → packet_created → sending → sent | queued_offline | failed
 *
 * This component is the single entry point for the full SOS flow:
 *   1. Request GPS
 *   2. Find nearest resource
 *   3. Build emergency packet
 *   4. Attempt send — queue if offline
 *   5. Notify contacts via SMS
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import type { EmergencyButtonState, IncidentType, EmergencyPacket } from '../types/emergency.types';
import { getCurrentLocation } from '../services/locationService';
import { buildEmergencyPacket, sendPacketToAPI } from '../services/emergencyPacketService';
import { findNearestResource } from '../services/resourceFinderService';
import { getOnlineDecision } from '../services/networkService';
import { enqueuePacket } from '../services/offlineQueueService';
import { sendEmergencySMS, getEmergencyContacts } from '../services/emergencyContactService';
import { getBatterySnapshot } from '../services/batteryService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmergencyButtonProps {
  incidentType: IncidentType;
  additionalNotes?: string;
  /** Optional: pass userId, deviceId, appVersion from host app auth system */
  userId?: string;
  deviceId?: string;
  appVersion?: string;
  /** Called when the flow completes (sent, queued, or failed) */
  onComplete?: (packet: EmergencyPacket, state: EmergencyButtonState) => void;
  /** Called on each state transition — useful for parent status displays */
  onStateChange?: (state: EmergencyButtonState) => void;
  /** Override API endpoint — omit to use mock */
  apiUrl?: string;
  /** Disable the button externally (e.g., while editing incident type) */
  disabled?: boolean;
}

// ─── Color Map ────────────────────────────────────────────────────────────────

const STATE_COLORS: Record<EmergencyButtonState, string> = {
  idle: '#CC0000',
  requesting_location: '#E65C00',
  packet_created: '#E65C00',
  sending: '#F0A500',
  queued_offline: '#7B5EA7',
  sent: '#2E7D32',
  failed: '#B71C1C',
};

const STATE_LABELS: Record<EmergencyButtonState, string> = {
  idle: 'SOS',
  requesting_location: 'Getting GPS…',
  packet_created: 'Preparing…',
  sending: 'Sending…',
  queued_offline: 'Queued',
  sent: 'Sent ✓',
  failed: 'Failed — Tap to Retry',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EmergencyButton({
  incidentType,
  additionalNotes = '',
  userId,
  deviceId,
  appVersion,
  onComplete,
  onStateChange,
  apiUrl,
  disabled = false,
}: EmergencyButtonProps) {
  const [buttonState, setButtonState] = React.useState<EmergencyButtonState>('idle');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const isActive =
    buttonState !== 'idle' &&
    buttonState !== 'sent' &&
    buttonState !== 'queued_offline' &&
    buttonState !== 'failed';

  // ── Pulse animation while active ──────────────────────────────────────────
  React.useEffect(() => {
    if (isActive) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseRef.current?.stop();
  }, [isActive, pulseAnim]);

  // ── State transition helper ───────────────────────────────────────────────
  const transition = useCallback(
    (state: EmergencyButtonState) => {
      setButtonState(state);
      onStateChange?.(state);
      AccessibilityInfo.announceForAccessibility(STATE_LABELS[state]);
    },
    [onStateChange]
  );

  // ── Press animation (stable — only uses Animated refs) ──────────────────
  const animatePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.93,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  // ── SOS flow — defined BEFORE handlePress so the closure is always fresh ──
  //
  // All props that feed into the packet (incidentType, additionalNotes, userId,
  // deviceId, appVersion, apiUrl, onComplete) are listed as deps so the
  // callback re-creates whenever they change, guaranteeing the packet always
  // reflects the current UI state when SOS is pressed.
  const executeSosFlow = useCallback(async () => {
    try {
      // Step 1: Get GPS (with last-known fallback)
      transition('requesting_location');
      const location = await getCurrentLocation();

      // Step 2: Find nearest resource (fully offline — local JSON)
      const nearestResource = findNearestResource(location.latitude, location.longitude);

      // Step 3: Read battery state (never throws)
      const battery = await getBatterySnapshot();

      // Step 4: Build packet
      transition('packet_created');
      const packet = await buildEmergencyPacket({
        location,
        incidentType,
        additionalNotes,
        nearestResource,
        userId,
        deviceId,
        appVersion,
        batteryLevel: battery.level,
        batteryCharging: battery.isCharging,
        batteryState: battery.batteryState,
        lowPowerModeEnabled: battery.lowPowerModeEnabled,
      });

      // Step 5: Network decision — handles isInternetReachable === null race
      transition('sending');
      const decision = await getOnlineDecision();

      if (decision.shouldAttemptNetworkSend) {
        // Attempt send. If it fails (catches unknown_but_connected case too),
        // fall back to queue rather than showing 'failed'.
        try {
          await sendPacketToAPI(packet, apiUrl);
          packet.status = 'sent';
          packet.sentAt = new Date().toISOString();
          transition('sent');
        } catch {
          // Send failed — queue for retry when connection is confirmed stable
          await enqueuePacket(packet);
          packet.status = 'queued';
          transition('queued_offline');
        }
      } else {
        await enqueuePacket(packet);
        packet.status = 'queued';
        transition('queued_offline');
      }

      // Step 6: SMS contacts (non-blocking — SMS failure must not break the flow)
      const contacts = await getEmergencyContacts();
      if (contacts.length > 0) {
        sendEmergencySMS(packet, contacts).catch((err) =>
          console.warn('[EmergencySDK] SMS error:', err)
        );
      }

      onComplete?.(packet, packet.status === 'sent' ? 'sent' : 'queued_offline');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      transition('failed');
      Alert.alert('SOS Failed', message, [{ text: 'OK' }]);
      onComplete?.(
        { id: 'error', incidentType, status: 'failed' } as EmergencyPacket,
        'failed'
      );
    }
  }, [
    transition,
    incidentType,
    additionalNotes,
    userId,
    deviceId,
    appVersion,
    apiUrl,
    onComplete,
  ]);

  // ── Press handler — confirmation dialog gate ──────────────────────────────
  const handlePress = useCallback(async () => {
    if (isActive || disabled) return;

    // If already sent/queued, tap resets to idle (allows re-trigger)
    if (buttonState === 'sent' || buttonState === 'queued_offline') {
      transition('idle');
      return;
    }

    animatePress();

    // Confirmation dialog — prevents accidental triggers
    Alert.alert(
      '🆘 Send SOS?',
      `This will send an emergency alert for:\n${incidentType.toUpperCase()}\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => void executeSosFlow(),
        },
      ]
    );
  }, [buttonState, isActive, disabled, incidentType, transition, animatePress, executeSosFlow]);

  const color = STATE_COLORS[buttonState];
  const label = STATE_LABELS[buttonState];

  return (
    <Animated.View
      style={[
        styles.outerRing,
        { borderColor: color },
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: color }]}
          onPress={handlePress}
          disabled={isActive || disabled}
          activeOpacity={0.85}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Emergency SOS button. Current state: ${label}`}
          accessibilityHint="Tap to send an emergency alert"
        >
          {isActive ? (
            <ActivityIndicator color="#FFF" size="large" />
          ) : (
            <View style={styles.innerContent}>
              <Text style={styles.sosText}>🆘</Text>
              <Text style={styles.stateLabel}>{label}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BUTTON_SIZE = 160;

const styles = StyleSheet.create({
  outerRing: {
    width: BUTTON_SIZE + 20,
    height: BUTTON_SIZE + 20,
    borderRadius: (BUTTON_SIZE + 20) / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    fontSize: 42,
    marginBottom: 4,
  },
  stateLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
