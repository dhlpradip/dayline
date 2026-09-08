import { Alert, Linking, Platform, View } from 'react-native';
import { useState } from 'react';
import { PRODUCT } from '@dayline/config';
import { useCalendarServices } from '../calendar-context';
import { Body, Button, Notice } from './ui';

export function PermissionPanel() {
  const { access, checkAccess } = useCalendarServices();
  const [dismissed, setDismissed] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  if (access === 'granted' || access === 'checking') return null;
  const explain = () =>
    Alert.alert(
      'Read your Apple calendars?',
      `${PRODUCT.name} needs full calendar access to browse events on iOS 17 and later. Events stay on this device and are not uploaded. This version is read-only: ${PRODUCT.name} will not add, edit or delete Apple events. You can continue with the local calendar without granting access.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void checkAccess(true);
          },
        },
      ],
    );
  if (dismissed)
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Button label="Local-only · Calendar access options" onPress={() => setDismissed(false)} />
      </View>
    );
  return (
    <Notice
      title={
        access === 'denied'
          ? 'Apple Calendar access is off'
          : access === 'unavailable'
            ? 'Your local calendar is ready'
            : access === 'error'
              ? 'Could not check calendar access'
              : 'Your schedule, without an account'
      }
    >
      <Body>
        {access === 'denied'
          ? 'Allow full calendar access in Settings to see Apple events. Local browsing remains available; local event creation is coming after this read-only milestone.'
          : access === 'unavailable'
            ? Platform.OS === 'ios'
              ? 'Apple Calendar requires a native development build. Local browsing works without access. No sample events are added.'
              : 'Apple Calendar browsing is iOS-only. Local browsing remains available on this device.'
            : 'Browse your Apple calendars privately, or stay local. No sign-in, no event uploads, and no sample events. Local event creation is not part of this read-only milestone.'}
      </Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {access === 'undetermined' && (
          <Button label="Connect Apple Calendar" selected onPress={explain} />
        )}
        {access === 'denied' && (
          <Button
            label="Open Settings"
            selected
            onPress={() => {
              void Linking.openSettings().catch(() => setSettingsError(true));
            }}
          />
        )}
        {(access === 'error' || access === 'unavailable' || access === 'denied') && (
          <Button
            label="Check again"
            onPress={() => {
              void checkAccess();
            }}
          />
        )}
        <Button label="Stay local" onPress={() => setDismissed(true)} />
      </View>
      {settingsError && (
        <Body>
          Settings could not be opened. Open iOS Settings → Apps → {PRODUCT.name} → Calendars
          manually.
        </Body>
      )}
    </Notice>
  );
}
