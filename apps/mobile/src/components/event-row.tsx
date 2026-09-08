import { Pressable, Text, View } from 'react-native';
import { format } from 'date-fns';
import { parseDate, type Calendar, type CalendarEvent } from '@dayline/domain';
import { useTheme } from '../theme';

export function eventTime(event: CalendarEvent): string {
  return event.allDay
    ? 'All day'
    : `${format(parseDate(event.start), 'HH:mm')} – ${format(parseDate(event.end), 'HH:mm')}`;
}
export function EventRow({
  event,
  calendars,
  onPress,
}: {
  event: CalendarEvent;
  calendars: Calendar[];
  onPress(): void;
}) {
  const theme = useTheme();
  const calendar = calendars.find((item) => item.id === event.calendarId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${eventTime(event)}, ${calendar?.title ?? 'Calendar'}`}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 14,
        minHeight: 64,
        flexDirection: 'row',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.line,
        backgroundColor: theme.surface,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{ width: 4, borderRadius: 3, backgroundColor: calendar?.color ?? theme.accent }}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{event.title}</Text>
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          {eventTime(event)} · {calendar?.title ?? 'Calendar'}
        </Text>
        {!!event.location && (
          <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13 }}>
            {event.location}
          </Text>
        )}
      </View>
      <Text
        accessibilityElementsHidden
        style={{ color: theme.muted, alignSelf: 'center', fontSize: 22 }}
      >
        ›
      </Text>
    </Pressable>
  );
}
