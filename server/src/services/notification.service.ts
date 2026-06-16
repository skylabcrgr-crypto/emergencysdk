/**
 * notification.service.ts
 * Mock push-notification service for incident status-change alerts.
 *
 * Current behaviour:
 *   - Builds a canonical notification payload and logs it to the console.
 *   - Does NOT send any real push notification (no network I/O).
 *
 * ─── Production TODOs ────────────────────────────────────────────────────────
 *
 * TODO(production/expo-push): Replace the mock logger with a POST to the
 *   Expo Push API:
 *
 *     const response = await fetch('https://exp.host/--/api/v2/push/send', {
 *       method: 'POST',
 *       headers: {
 *         'Content-Type': 'application/json',
 *         'Accept': 'application/json',
 *         // TODO(production/expo-access-token): Add 'Authorization: Bearer <EXPO_ACCESS_TOKEN>'
 *         // when using the enhanced (authenticated) Expo Push API.
 *       },
 *       body: JSON.stringify({
 *         to: pushToken,
 *         title: payload.title,
 *         body: payload.body,
 *         data: payload.data,
 *         sound: 'default',
 *         priority: 'high',
 *         channelId: 'incident-updates', // Android notification channel
 *       }),
 *     });
 *
 * TODO(production/fcm-direct): For production-grade reliability, bypass the
 *   Expo gateway and send directly via Firebase Cloud Messaging (FCM) v1 HTTP
 *   API (OAuth 2.0 service account credentials). This avoids Expo Push quotas
 *   and gives full control over delivery tracking:
 *   https://firebase.google.com/docs/cloud-messaging/send-message
 *
 * TODO(production/apns-direct): For iOS-only deployments, send via APNs HTTP/2
 *   using a JWT signed with your .p8 key:
 *   https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
 *
 * TODO(production/queue): Use a background job queue (BullMQ / pg-boss) to
 *   retry failed deliveries with exponential back-off instead of fire-and-forget.
 *
 * TODO(production/device-table): Migrate pushToken off EmergencyIncident and
 *   into a UserDevice table (userId → [pushToken, platform, registeredAt,
 *   lastSeen]) so that:
 *     - One user with multiple devices gets all devices notified.
 *     - Expired tokens are pruned on 'DeviceNotRegistered' errors from FCM/APNs.
 *     - Token rotation on app reinstall is handled gracefully.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface NotificationPayload {
  /** Expo Push Token of the target device. */
  pushToken: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface NotificationResult {
  /** true if the notification was dispatched (or logged in demo mode). */
  dispatched: boolean;
  /** Human-readable result for dashboard confirmation messages. */
  summary: string;
}

const STATUS_LABELS: Record<string, string> = {
  queued:       'Queued',
  received:     'Received by operator',
  reviewing:    'Under review',
  dispatched:   '🚨 Help is on the way',
  acknowledged: '✅ Responder acknowledged',
  resolved:     '✔️ Incident resolved',
  false_alarm:  '⚠️ Marked as false alarm',
  closed:       '🔒 Incident closed',
};

/**
 * Sends (or mocks) a push notification for an incident status change.
 *
 * @param pushToken  Expo push token from EmergencyIncident.pushToken.
 * @param incidentId The formatted incident ID (e.g. "INC-0001").
 * @param newStatus  The new IncidentStatus value.
 * @param operatorNote Optional note from the operator.
 */
export async function sendStatusChangeNotification(
  pushToken: string,
  incidentId: string,
  newStatus: string,
  operatorNote?: string | null
): Promise<NotificationResult> {
  const label = STATUS_LABELS[newStatus] ?? newStatus;
  const body  = operatorNote
    ? `${label}\nNote: ${operatorNote}`
    : label;

  const payload: NotificationPayload = {
    pushToken,
    title: `Emergency Update — ${incidentId}`,
    body,
    data: { incidentId, newStatus, operatorNote: operatorNote ?? null },
  };

  // ── Demo / development: log the payload ───────────────────────────────────
  // TODO(production/expo-push): Replace this block with a real push API call.
  console.log(
    `[NotificationService] DEMO — would send push to token ${pushToken.slice(0, 30)}…\n` +
    `  title: ${payload.title}\n` +
    `  body:  ${payload.body}\n` +
    `  data:  ${JSON.stringify(payload.data)}`
  );
  // ─────────────────────────────────────────────────────────────────────────

  return {
    dispatched: true,
    summary: `Push notification queued (demo) → ${incidentId} status: ${newStatus}`,
  };
}

/**
 * No-op when no push token is available.
 * Logs an info message so operators can see that no notification was sent.
 */
export function logMissingPushToken(incidentId: string, newStatus: string): void {
  console.info(
    `[NotificationService] No push token for ${incidentId} (status → ${newStatus}). ` +
    'Skipping push notification.'
  );
}
