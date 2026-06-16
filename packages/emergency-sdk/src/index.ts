/**
 * @skylab/emergency-sdk
 * Public API for the Emergency Response SDK.
 *
 * Install in any Michigan state agency Expo React Native app:
 *   import { EmergencyButton, findNearestResource, ... } from '@skylab/emergency-sdk';
 *
 * Target apps:
 *   - Michigan Fishing app
 *   - Michigan Parks app
 *   - Michigan Boating app
 *   - Michigan Hunting app
 *   - Michigan Tourism app
 *   - Michigan Trails app
 */

// ─── Components ───────────────────────────────────────────────────────────────
export { EmergencyButton } from './components/EmergencyButton';
export { IncidentTypeSelector } from './components/IncidentTypeSelector';
export { EmergencyStatusCard } from './components/EmergencyStatusCard';

// ─── Services ─────────────────────────────────────────────────────────────────
export {
  requestLocationPermission,
  checkLocationPermission,
  getCurrentLocation,
  buildGoogleMapsUrl,
  formatCoordinates,
} from './services/locationService';

export {
  getNetworkState,
  subscribeToNetworkChanges,
  isOnline,
  getSignalStatus,
  getOnlineDecision,
} from './services/networkService';

export {
  getBatterySnapshot,
} from './services/batteryService';

export {
  buildEmergencyPacket,
  sendPacketToAPI,
} from './services/emergencyPacketService';

export {
  enqueuePacket,
  getQueuedPackets,
  removeFromQueue,
  incrementAttemptCount,
  getRetryablePackets,
  getQueueCount,
  clearQueue,
  flushQueue,
} from './services/offlineQueueService';

export {
  getAllResources,
  getResourcesByType,
  getResourcesByCounty,
  findNearestResource,
  findNearestResources,
  haversineDistanceMiles,
  formatDistanceMiles,
  loadResources,
  refreshResourcesFromBackend,
  clearResourceCache,
  getResourceSource,
} from './services/resourceFinderService';

export {
  buildSMSBody,
  buildSMSPayload,
  sendEmergencySMS,
  saveEmergencyContacts,
  getEmergencyContacts,
} from './services/emergencyContactService';

export {
  getDeviceEncryptionKey,
  deleteDeviceEncryptionKey,
  hasDeviceEncryptionKey,
} from './services/secureStorageService';

export {
  encryptString,
  decryptString,
  isEncryptedPayload,
} from './services/encryptionService';

export {
  registerForPushNotifications,
  getCachedPushToken,
  clearPushToken,
  showLocalStatusNotification,
} from './services/pushNotificationService';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  IncidentType,
  EmergencyButtonState,
  EmergencyLocation,
  EmergencyResource,
  NearestResource,
  ResourceType,
  EmergencyPacket,
  PacketStatus,
  SignalStatus,
  QueuedPacket,
  EmergencySMSPayload,
  EmergencyContact,
  NetworkState,
  EmergencyAPIResponse,
  EmergencySDKConfig,
} from './types/emergency.types';

export type {
  OnlineDecision,
  OnlineDecisionStatus,
} from './services/networkService';

export type {
  BatterySnapshot,
  BatteryStateLabel,
} from './services/batteryService';

// ─── Constants ────────────────────────────────────────────────────────────────
export {
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPE_ICONS,
} from './types/emergency.types';
