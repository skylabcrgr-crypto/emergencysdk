/**
 * app.config.ts
 * Dynamic Expo configuration driven by EXPO_PUBLIC_* environment variables.
 *
 * Environment variables (set in .env or EAS secrets):
 *   EXPO_PUBLIC_API_BASE_URL   — Backend base URL  (default: http://localhost:3001)
 *   EXPO_PUBLIC_MAPBOX_TOKEN   — Optional Mapbox token for map features
 *   EXPO_PUBLIC_SOURCE_APP     — Source app identifier (default: dev)
 *   EAS_PROJECT_ID             — Expo project ID for push notifications
 *
 * Replaces static app.json. Delete app.json if you use this file.
 * (app.config.ts takes precedence over app.json when both exist.)
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: 'ER Offline SDK',
  slug: 'er-offline-sdk',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0D0D0D',
  },

  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'gov.michigan.er-offline-sdk',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Your location is used to determine your position during an emergency and find the nearest help.',
      NSLocationAlwaysUsageDescription:
        'Background location is used to update your position if an emergency alert is queued while offline.',
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D0D0D',
    },
    package: 'gov.michigan.erofflinessdk',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'SEND_SMS',
      'READ_PHONE_STATE',
      'INTERNET',
      'ACCESS_NETWORK_STATE',
    ],
  },

  web: {
    favicon: './assets/favicon.png',
  },

  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow ER SDK to access your location for emergency response.',
        locationWhenInUsePermission:
          'Allow ER SDK to access your location to find your position in an emergency.',
      },
    ],
  ],

  /**
   * Runtime environment — accessible via Constants.expoConfig.extra
   * in the mobile app code.
   *
   * EXPO_PUBLIC_* vars are also directly accessible via process.env.EXPO_PUBLIC_*
   * in JS/TS source files (Expo's metro-transform inlines them at build time).
   */
  extra: {
    apiBaseUrl:  process.env.EXPO_PUBLIC_API_BASE_URL   ?? 'http://localhost:3001',
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN   ?? '',
    sourceApp:   process.env.EXPO_PUBLIC_SOURCE_APP     ?? 'dev',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? undefined,
    },
  },
});
