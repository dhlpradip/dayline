import { Pressable, ScrollView, Text, View } from 'react-native';
import { format, isSameMonth, isToday } from 'date-fns';
import { dateKey, datesInRange, eventsForDay, monthRange } from '@dayline/domain';
import type { CalendarViewProps } from '../use-calendar';
import { useTheme } from '../theme';
import { EventRow } from '../components/event-row';
import { Body } from '../components/ui';

export function MonthView({
  events,
  calendars,
  selectedDate,
  onSelectDay,
  onOpenEvent,
}: CalendarViewProps) {
  const theme = useTheme();
  const days = datesInRange(monthRange(selectedDate));
  const selectedEvents = eventsForDay(events, selectedDate);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ marginHorizontal: 8, flexDirection: 'row' }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => (
          <Text
            key={name}
            style={{
              width: `${100 / 7}%`,
              textAlign: 'center',
              paddingVertical: 10,
              color: theme.muted,
              fontSize: 11,
              fontWeight: '600',
            }}
          >
            {name}
          </Text>
        ))}
      </View>
      <View
        style={{
          marginHorizontal: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderTopWidth: 1,
          borderColor: theme.border,
        }}
      >
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day);
          const selected = dateKey(day) === dateKey(selectedDate);
          return (
            <Pressable
              key={dateKey(day)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${format(day, 'EEEE, MMMM d, yyyy')}, ${dayEvents.length} events${isToday(day) ? ', today' : ''}`}
              onPress={() => onSelectDay(day)}
              style={{
                width: `${100 / 7}%`,
                minHeight: 96,
                padding: 3,
                gap: 4,
                backgroundColor: selected ? theme.accentSoft : theme.surface,
                borderBottomWidth: 1,
                borderRightWidth: 1,
                borderColor: theme.line,
              }}
            >
              <Text
                style={{
                  color: isToday(day)
                    ? theme.today
                    : isSameMonth(day, selectedDate)
                      ? theme.text
                      : theme.muted,
                  alignSelf: 'center',
                  fontSize: 15,
                  fontWeight: selected || isToday(day) ? '800' : '500',
                  paddingVertical: 3,
                }}
              >
                {format(day, 'd')}
              </Text>
              {dayEvents.slice(0, 2).map((event) => (
                <View
                  key={event.id}
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor:
                      calendars.find((calendar) => calendar.id === event.calendarId)?.color ??
                      theme.accent,
                    paddingLeft: 2,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 10, color: theme.text }}>
                    {event.title}
                  </Text>
                </View>
              ))}
              {dayEvents.length > 2 && (
                <Text style={{ fontSize: 10, color: theme.muted }}>
                  +{dayEvents.length - 2} more
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 20, paddingHorizontal: 18, paddingBottom: 12, gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}
        >
          {format(selectedDate, 'EEEE, MMMM d')}
        </Text>
        <Body>
          {selectedEvents.length
            ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`
            : 'No events on this day.'}
        </Body>
      </View>
      {selectedEvents.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          calendars={calendars}
          onPress={() => onOpenEvent(event)}
        />
      ))}
    </ScrollView>
  );
}
