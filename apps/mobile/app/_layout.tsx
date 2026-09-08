import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { bootstrap } from '../src/database';
import { CalendarServices } from '../src/calendar-context';
import { useTheme } from '../src/theme';
import { PRODUCT } from '@dayline/config';

export default function RootLayout() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setFailed(false);
    void bootstrap().then(
      () => {
        if (mounted) setReady(true);
      },
      () => {
        if (mounted) setFailed(true);
      },
    );
    return () => {
      mounted = false;
    };
  }, [attempt]);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {ready ? (
        <CalendarServices>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="event/[token]" options={{ presentation: 'modal' }} />
          </Stack>
        </CalendarServices>
      ) : (
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: theme.background,
            justifyContent: 'center',
            padding: 28,
            gap: 20,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontSize: 32, fontWeight: '700' }}
          >
            {PRODUCT.name}
          </Text>
          {failed ? (
            <>
              <Text accessibilityRole="alert" style={{ color: theme.text, fontSize: 17 }}>
                Local storage could not be opened. Your data has not been reset. Retry, or update
                {PRODUCT.name} if this database was created with a newer version.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((value) => value + 1)}
                style={{ padding: 16, borderRadius: 12, backgroundColor: theme.accentSoft }}
              >
                <Text style={{ color: theme.accent, fontWeight: '600' }}>
                  Retry opening local storage
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color={theme.accent} />
              <Text style={{ color: theme.muted }}>
                Preparing your private, on-device calendar…
              </Text>
            </>
          )}
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}
