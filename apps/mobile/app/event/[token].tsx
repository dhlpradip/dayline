import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { parseDate, type CalendarEvent } from '@dayline/domain';
import { resolveEvent } from '../../src/event-navigation';
import { useCalendarServices } from '../../src/calendar-context';
import { CalendarAccessError } from '../../src/apple-provider';
import { localProvider } from '../../src/database';
import { useTheme } from '../../src/theme';
import { Body, Button, Notice } from '../../src/components/ui';

function dateDescription(event: CalendarEvent): string {
  if (event.allDay) {
    const start = format(parseDate(event.start), 'EEEE, MMMM d, yyyy');
    const lastDay = subDays(parseDate(event.end), 1);
    return `${start}${format(lastDay, 'yyyy-MM-dd') !== event.start ? ` – ${format(lastDay, 'EEEE, MMMM d, yyyy')}` : ''}\nAll day`;
  }
  return `${format(parseDate(event.start), 'EEE, MMM d, yyyy · HH:mm')}\n${format(parseDate(event.end), 'EEE, MMM d, yyyy · HH:mm')}\nTimes shown in your device’s timezone`;
}
export default function EventScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { access, epoch, apple, checkAccess } = useCalendarServices();
  const handle = typeof token === 'string' ? resolveEvent(token) : undefined;
  const isSystem = handle?.providerId === 'apple-system';
  const allowed = !!handle && (!isSystem || access === 'granted');
  const eventQuery = useQuery({
    queryKey: [
      'calendar-data',
      isSystem ? 'system' : 'local',
      'detail',
      token,
      isSystem ? access : 'local',
      isSystem ? epoch : 0,
    ],
    enabled: allowed,
    queryFn: async ({ signal }) => {
      if (!handle) return null;
      const event = await (isSystem ? apple : localProvider).getEvent(handle.id);
      if (signal.aborted) throw new Error('Calendar read cancelled.');
      return event;
    },
  });
  const calendars = useQuery({
    queryKey: [
      'calendar-data',
      isSystem ? 'system' : 'local',
      'detail-calendars',
      isSystem ? access : 'local',
      isSystem ? epoch : 0,
    ],
    enabled: allowed,
    queryFn: async ({ signal }) => {
      const value = await (isSystem ? apple : localProvider).getCalendars();
      if (signal.aborted) throw new Error('Calendar read cancelled.');
      return value;
    },
  });
  useEffect(() => {
    if (
      eventQuery.error instanceof CalendarAccessError ||
      calendars.error instanceof CalendarAccessError
    )
      void checkAccess();
  }, [eventQuery.error, calendars.error, checkAccess]);
  const event = allowed ? eventQuery.data : undefined;
  const calendar = calendars.data?.find((item) => item.id === event?.calendarId);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
        }}
      >
        <Button label="Close" onPress={close} />
        <Text style={{ color: theme.muted, fontSize: 13 }}>EVENT DETAILS · READ-ONLY</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {isSystem && access === 'checking' ? (
          <ActivityIndicator color={theme.accent} accessibilityLabel="Checking calendar access" />
        ) : !allowed ? (
          <Notice title="This event is unavailable">
            <Body>
              Calendar access may have changed, or this session link has expired. Return to your
              calendar and select the event again.
            </Body>
          </Notice>
        ) : eventQuery.isPending ? (
          <ActivityIndicator color={theme.accent} accessibilityLabel="Loading event" />
        ) : eventQuery.isError ? (
          <Notice title="Could not load this event" error>
            <Body>No event details were changed.</Body>
            <Button
              label="Retry"
              onPress={() => {
                void eventQuery.refetch();
              }}
            />
          </Notice>
        ) : !event ? (
          <Notice title="Event no longer found">
            <Body>
              It may have been moved, changed or deleted in Apple Calendar. Return to the calendar
              and refresh.
            </Body>
          </Notice>
        ) : (
          <>
            <View style={{ padding: 24, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: calendar?.color ?? theme.accent,
                  }}
                />
                <Body>{calendar?.title ?? (isSystem ? 'Apple Calendar' : 'On this device')}</Body>
              </View>
              <Text
                accessibilityRole="header"
                selectable
                style={{ color: theme.text, fontSize: 30, fontWeight: '700' }}
              >
                {event.title}
              </Text>
              <Text selectable style={{ color: theme.text, fontSize: 17, lineHeight: 26 }}>
                {dateDescription(event)}
              </Text>
            </View>
            {!!event.location && (
              <Notice title="Location">
                <Text selectable style={{ color: theme.text, fontSize: 16 }}>
                  {event.location}
                </Text>
              </Notice>
            )}
            {!!event.description && (
              <Notice title="Notes">
                <Text selectable style={{ color: theme.text, fontSize: 16, lineHeight: 25 }}>
                  {event.description}
                </Text>
              </Notice>
            )}
            {!!event.url && (
              <Notice title="Event link">
                <Text selectable style={{ color: theme.text, fontSize: 15 }}>
                  {event.url}
                </Text>
                <Body>Links are displayed as text and never opened automatically.</Body>
              </Notice>
            )}
            <Notice title="Calendar information">
              <Body>
                {calendar?.source ?? 'Calendar source unavailable'}
                {event.recurring ? ' · Repeating event' : ''}
                {event.status ? ` · ${event.status}` : ''}
              </Body>
              {!!event.timezone && <Body>Event timezone: {event.timezone}</Body>}
            </Notice>
            {calendars.isError && (
              <Notice title="Calendar information could not be loaded" error>
                <Button
                  label="Retry calendar information"
                  onPress={() => {
                    void calendars.refetch();
                  }}
                />
              </Notice>
            )}
            <Notice title="A private, read-only view">
              <Body>
                {isSystem
                  ? 'To make changes, use Apple Calendar and refresh this view. This view shows this specific occurrence, not the series master.'
                  : 'Local create and edit are deferred beyond this milestone. Your local data stays on this device.'}
              </Body>
            </Notice>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
