# @skylab/emergency-sdk

Emergency Response SDK for Michigan state agency Expo React Native apps.

Provides offline-first SOS alerting, GPS capture, AES-256-GCM encrypted queue, nearest resource matching, and push notification support. Designed to drop into any Michigan DNR/state-agency mobile application.

> **This SDK does not replace 911. It does not connect to any active dispatch center. See the Emergency Disclaimer before deployment.**

---

## Target Apps

- Michigan Fishing app
- Michigan Parks app
- Michigan Boating app
- Michigan Hunting app
- Michigan Tourism app
- Michigan Trails app
- Any Expo React Native Michigan state-agency app

---

## Installation

This package is not published to npm. It is distributed as a local workspace package inside the `er-offline-sdk` monorepo.

```bash
# From the monorepo root
npm install   # creates node_modules/@skylab/emergency-sdk symlink automatically
```

To add to a new app within the monorepo:

```json
// In your app's package.json
{
  "dependencies": {
    "@skylab/emergency-sdk": "*"
  }
}
```

---

## Peer Dependencies

Install these in the host application:

```bash
npx expo install \
  expo-location \
  expo-sms \
  expo-battery \
  expo-notifications \
  expo-device \
  expo-secure-store \
  @react-native-community/netinfo \
  @react-native-async-storage/async-storage
```

---

## Required Expo Permissions

### `app.json` / `app.config.ts`

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Your location is used to find your position in an emergency.",
        "NSLocationAlwaysUsageDescription": "Background location updates your position if an alert is queued while offline."
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "SEND_SMS",
        "READ_PHONE_STATE",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "plugins": [
      ["expo-location", {
        "locationAlwaysAndWhenInUsePermission": "Allow access to your location for emergency response.",
        "locationWhenInUsePermission": "Allow access to your location in an emergency."
      }]
    ]
  }
}
```

---

## Basic Usage

### Drop-in SOS Button

```tsx
import { EmergencyButton } from '@skylab/emergency-sdk';

export function MyScreen() {
  return (
    <EmergencyButton
      apiUrl="https://api.youragency.gov/api/emergency/incidents"
      incidentType="boating"
      additionalNotes="Lake Superior patrol zone 4"
      onSuccess={(packet) => console.log('Alert sent:', packet.id)}
      onQueued={(packet) => console.log('Alert queued:', packet.id)}
      onError={(error) => console.error('Alert failed:', error)}
    />
  );
}
```

### Incident Type Selector

```tsx
import { IncidentTypeSelector } from '@skylab/emergency-sdk';
import type { IncidentType } from '@skylab/emergency-sdk';

function MySOSFlow() {
  const [type, setType] = useState<IncidentType>('medical');
  return <IncidentTypeSelector value={type} onChange={setType} />;
}
```

### Status Card

```tsx
import { EmergencyStatusCard } from '@skylab/emergency-sdk';

// Shows the last sent/queued packet with GPS, battery, and status info
<EmergencyStatusCard packet={activePacket} buttonState={buttonState} />
```

---

## API URL Configuration

Set the backend URL using the Expo public environment variable:

```bash
# .env (or EAS secrets)
EXPO_PUBLIC_API_BASE_URL=https://api.youragency.gov
```

The `EmergencyButton` accepts the `apiUrl` prop directly, or you can use the service:

```typescript
import { sendPacketToAPI, buildEmergencyPacket } from '@skylab/emergency-sdk';

const packet = await buildEmergencyPacket({
  incidentType: 'lost',
  additionalNotes: 'Backcountry trail, no signal',
});

await sendPacketToAPI(
  packet,
  process.env.EXPO_PUBLIC_API_BASE_URL + '/api/emergency/incidents'
);
```

---

## Offline Queue

When the device has no connectivity, packets are automatically stored in an encrypted local queue and retried when connectivity returns.

### How it works

1. User triggers SOS. `getOnlineDecision()` evaluates current connectivity.
2. If **online**: packet is sent immediately via HTTP POST.
3. If **offline**: `enqueuePacket(packet)` encrypts and stores it in AsyncStorage.
4. When connectivity returns: `flushQueue(sendFn)` dequeues, deduplicates, and retries each packet.
5. Successfully sent packets are removed from the queue.

### Encrypted storage

Queued packets are encrypted with **AES-256-GCM** using a per-device key stored in the OS secure keystore (iOS Keychain / Android Keystore via `expo-secure-store`). The encryption key is generated on first use and never leaves the device in plaintext.

```typescript
import { flushQueue, getQueueCount, sendPacketToAPI } from '@skylab/emergency-sdk';

// Wire to app startup, network reconnection, and foreground return
const sendFn = (packet) =>
  sendPacketToAPI(packet, API_URL).then((r) => r.success);

// Get queue size
const count = await getQueueCount();

// Flush pending packets
await flushQueue(sendFn);
```

### Important limitations

- If the device **never regains connectivity**, queued alerts may never be transmitted.
- If the device **loses power** before transmission, queued alerts are preserved in encrypted storage and will retry on next launch.
- The offline queue is **best-effort** — it is not a guaranteed delivery protocol.
- Users should always attempt to call **911 directly** if any signal is available.

---

## Resource Finder

```typescript
import { findNearestResource, findNearestResources } from '@skylab/emergency-sdk';

// Find single nearest resource to current GPS position
const nearest = await findNearestResource(lat, lng);
// → { name, type, phone, county, distanceMiles, ... }

// Find N nearest, optionally filtered by type
const resources = await findNearestResources(lat, lng, 5, 'marine_patrol');
```

Resources are loaded from a bundled JSON dataset and can be refreshed from the backend API:

```typescript
import { refreshResourcesFromBackend, getResourceSource } from '@skylab/emergency-sdk';

await refreshResourcesFromBackend(
  'https://api.youragency.gov/api/emergency/resources'
);
const source = await getResourceSource(); // 'backend' | 'bundled'
```

---

## Push Notifications

```typescript
import { registerForPushNotifications, showLocalStatusNotification } from '@skylab/emergency-sdk';

// Register at app startup (on real device only — skipped on simulators)
const result = await registerForPushNotifications();
// result.status: 'granted' | 'simulator' | 'denied' | 'error'

// Show local notification when incident status changes
await showLocalStatusNotification('INC-001', 'dispatched', 'Unit en route');
```

> **Production note:** The push token is included in every `EmergencyPacket`. The backend stores it on the incident record and sends a mock payload on status change. Real APNs/FCM delivery requires `EAS_PROJECT_ID` to be set in `app.config.ts`.

---

## Full Export Reference

```typescript
// Components
EmergencyButton, IncidentTypeSelector, EmergencyStatusCard

// Packet building
buildEmergencyPacket, sendPacketToAPI

// Queue
enqueuePacket, getQueuedPackets, flushQueue, getQueueCount, clearQueue,
removeFromQueue, incrementAttemptCount, getRetryablePackets

// Network
getNetworkState, subscribeToNetworkChanges, isOnline, getSignalStatus,
getOnlineDecision

// Location
requestLocationPermission, checkLocationPermission, getCurrentLocation,
buildGoogleMapsUrl, formatCoordinates

// Battery
getBatterySnapshot

// Resources
getAllResources, getResourcesByType, getResourcesByCounty,
findNearestResource, findNearestResources, haversineDistanceMiles,
formatDistanceMiles, loadResources, refreshResourcesFromBackend,
clearResourceCache, getResourceSource

// Encryption
encryptString, decryptString, isEncryptedPayload

// Secure storage
getDeviceEncryptionKey, deleteDeviceEncryptionKey, hasDeviceEncryptionKey

// Push notifications
registerForPushNotifications, getCachedPushToken, clearPushToken,
showLocalStatusNotification

// SMS
buildSMSBody, buildSMSPayload, sendEmergencySMS,
saveEmergencyContacts, getEmergencyContacts

// Types
IncidentType, EmergencyButtonState, EmergencyLocation, EmergencyResource,
NearestResource, ResourceType, EmergencyPacket, PacketStatus, SignalStatus,
QueuedPacket, EmergencySMSPayload, EmergencyContact, NetworkState,
EmergencyAPIResponse, EmergencySDKConfig, OnlineDecision, OnlineDecisionStatus,
BatterySnapshot, BatteryStateLabel

// Constants
INCIDENT_TYPE_LABELS, INCIDENT_TYPE_ICONS
```

---

## Emergency Disclaimer

**This SDK and any application using it does not replace 911. It does not connect to any Public Safety Answering Point (PSAP), dispatch center, or emergency response infrastructure.**

- Offline queue transmission is not guaranteed if the device never regains connectivity.
- GPS accuracy depends on device hardware and environmental conditions.
- The system has no uptime guarantee.
- Applications using this SDK must display an emergency disclaimer to users at first launch.
- Always instruct users to call 911 first if they have any signal.

See [EMERGENCY_DISCLAIMER.md](../../docs/demo-package/EMERGENCY_DISCLAIMER.md) for the full disclaimer.

---

## Metro Bundler Configuration

For Expo apps consuming this package via npm workspaces, add `metro.config.js` to the host app:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to watch the packages/ directory
config.watchFolders = [
  path.resolve(__dirname, '../../packages'),
  ...config.watchFolders,
];

module.exports = config;
```
