/**
 * pushNotificationService.ts
 * Manages Expo push token registration and local notification display
 * for the Emergency Response SDK.
 *
 * ─── Architecture overview ────────────────────────────────────────────────────
 *   Registration flow:
 *     1. App starts → registerForPushNotifications() checks permissions.
 *     2. If granted on a real device, getExpoPushTokenAsync() returns the token.
 *     3. Token is stored locally and included in outgoing EmergencyPackets
 *        so the backend can send status-change notifications.
 *
 *   Notification display:
 *     - When the backend ACKs a status change, it should send an Expo Push
 *       notification to the stored token.
 *     - Alternatively, when the app is in the foreground and a status change
 *       is polled from the server, showLocalStatusNotification() fires a
 *       device-local notification.
 *
 * ─── Production TODOs ────────────────────────────────────────────────────────
 *
 * TODO(production/apns): Upload an APNs .p8 Auth Key to Expo EAS dashboard
 *   (Account → Credentials → iOS → Auth Keys). Without this, push tokens are
 *   registered but notifications are never delivered on iOS.
 *
 * TODO(production/fcm): Add google-services.json to the Android project root
 *   and set android.googleServicesFile in app.json / app.config.js.
 *   Without this, push tokens are registered but notifications are never
 *   delivered on Android.
 *
 * TODO(production/project-id): Replace the EAS_PROJECT_ID constant with your
 *   actual Expo project ID from https://expo.dev (Project → Settings → ID).
 *   Without a projectId, getExpoPushTokenAsync() will fail on production builds.
 *   You can also set it in app.json: { "expo": { "extra": { "eas": { "projectId": "..." } } } }
 *
 * TODO(production/notification-handler): Wire addNotificationResponseReceivedListener
 *   to deep-link into the correct incident detail screen when the user taps a
 *   push notification.
 *
 * TODO(production/background): Add expo-background-fetch or expo-task-manager
 *   to receive push-triggered background updates even when the app is killed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = '@er_sdk/push_token_v1';

/**
 * TODO(production/project-id): Replace with your real Expo project ID.
 * Leave undefined during development — token registration will be skipped
 * with a warning rather than crashing.
 */
const EAS_PROJECT_ID: string | undefined = undefined;

// ─── Notification handler (foreground display) ────────────────────────────────

// Show notifications even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PushRegistrationResult =
  | { status: 'granted'; token: string }
  | { status: 'simulator'; reason: string }
  | { status: 'denied'; reason: string }
  | { status: 'error'; reason: string };

// ─── Token registration ───────────────────────────────────────────────────────

/**
 * Requests notification permissions and retrieves the Expo Push Token.
 * Persists the token to AsyncStorage for use in EmergencyPackets.
 *
 * Should be called once at app startup (e.g. in App.tsx useEffect).
 *
 * Returns a PushRegistrationResult describing the outcome.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  // Push tokens only work on real devices (not simulator/emulator).
  if (!Device.isDevice) {
    const reason = 'Push notifications require a real device. Running in simulator — skipping.';
    console.info('[PushNotification]', reason);
    return { status: 'simulator', reason };
  }

  // Check / request permissions.
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    const reason = 'Push notification permission denied by user.';
    console.warn('[PushNotification]', reason);
    return { status: 'denied', reason };
  }

  // Project ID is required for Expo-managed push tokens.
  if (!EAS_PROJECT_ID) {
    const reason =
      'EAS_PROJECT_ID is not configured. Skipping Expo Push Token registration. ' +
      'Set EAS_PROJECT_ID in pushNotificationService.ts for production builds.';
    console.warn('[PushNotification]', reason);
    return { status: 'error', reason };
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    const token = tokenData.data;

    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    console.info('[PushNotification] Token registered:', token);
    return { status: 'granted', token };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[PushNotification] Token registration failed:', reason);
    return { status: 'error', reason };
  }
}

/**
 * Returns the cached push token, or null if not registered.
 */
export async function getCachedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clears the stored push token (e.g. on sign-out / reset).
 */
export async function clearPushToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
}

// ─── Local notifications ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  queued:       'Queued',
  received:     'Received by operator',
  reviewing:    'Under review',
  dispatched:   'Help is on the way',
  acknowledged: 'Responder acknowledged',
  resolved:     'Incident resolved',
  false_alarm:  'Marked as false alarm',
  closed:       'Incident closed',
};

const STATUS_ICONS: Record<string, string> = {
  queued:       '📋',
  received:     '👀',
  reviewing:    '🔍',
  dispatched:   '🚨',
  acknowledged: '✅',
  resolved:     '✔️',
  false_alarm:  '⚠️',
  closed:       '🔒',
};

/**
 * Fires a device-local notification when an incident status changes.
 * Call this when the app is in the foreground and a status update is polled
 * or received via WebSocket.
 *
 * Does NOT send a remote push notification — that must be triggered by the
 * backend via the Expo Push API (see notification.service.ts on the server).
 */
export async function showLocalStatusNotification(
  serverIncidentId: string,
  newStatus: string,
  operatorNote?: string | null
): Promise<void> {
  const label = STATUS_LABELS[newStatus] ?? newStatus;
  const icon  = STATUS_ICONS[newStatus] ?? '📣';

  const body = operatorNote
    ? `${icon} ${label}\nOperator note: ${operatorNote}`
    : `${icon} ${label}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Emergency Update — ${serverIncidentId}`,
      body,
      data: { serverIncidentId, newStatus },
      sound: true,
    },
    trigger: null, // fire immediately
  });
}
