import type { ExpoConfig } from 'expo/config';
import { PRODUCT } from '@dayline/config';

const config: ExpoConfig = {
  name: PRODUCT.name,
  slug: PRODUCT.slug,
  scheme: PRODUCT.scheme,
  version: '0.1.0',
  orientation: 'default',
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: PRODUCT.iosBundleIdentifier,
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    [
      'expo-calendar',
      {
        calendarPermission: `${PRODUCT.name} reads your calendars to show your schedule on this device. Your events are not uploaded.`,
        remindersPermission: false,
        writeOnlyAccess: false,
      },
    ],
  ],
};
export default config;
