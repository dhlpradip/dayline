import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { format, isToday } from 'date-fns';
import { dateKey, datesInRange, eventsForDay, layoutEvents } from '@dayline/domain';
import type { CalendarViewProps } from '../use-calendar';
import { useTheme } from '../theme';
import { eventTime } from '../components/event-row';

const MINUTE_HEIGHT = 1;
const GUTTER = 48;
export function TimelineView({
  events,
  calendars,
  range,
  onSelectDay,
  onOpenEvent,
}: CalendarViewProps) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const days = datesInRange(range);
  const dayWidth = Math.max(
    days.length === 1 ? width - GUTTER : 132 * Math.min(fontScale, 1.6),
    (width - GUTTER) / days.length,
  );
  const totalWidth = GUTTER + dayWidth * days.length;
  const vertical = useRef<ScrollView>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const rangeStart = range.start.getTime();
  useEffect(() => {
    vertical.current?.scrollTo({ y: 7 * 60 * MINUTE_HEIGHT, animated: false });
  }, [rangeStart]);
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  return (
    <ScrollView
      horizontal
      directionalLockEnabled
      style={{ flex: 1 }}
      contentContainerStyle={{ width: totalWidth }}
    >
      <View style={{ width: totalWidth, flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            paddingLeft: GUTTER,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderColor: theme.border,
          }}
        >
          {days.map((day) => (
            <Pressable
              key={dateKey(day)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${format(day, 'EEEE MMMM d')}`}
              onPress={() => onSelectDay(day)}
              style={{ width: dayWidth, alignItems: 'center', padding: 10, gap: 3 }}
            >
              <Text style={{ color: theme.muted, fontSize: 12 }}>{format(day, 'EEE')}</Text>
              <Text
                style={{
                  color: isToday(day) ? theme.today : theme.text,
                  fontSize: 22,
                  fontWeight: '700',
                }}
              >
                {format(day, 'd')}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          nestedScrollEnabled
          style={{
            maxHeight: 160,
            flexGrow: 0,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderColor: theme.border,
          }}
          contentContainerStyle={{ flexDirection: 'row' }}
        >
          <Text
            style={{ width: GUTTER, padding: 4, paddingTop: 12, fontSize: 10, color: theme.muted }}
          >
            ALL{'\n'}DAY
          </Text>
          {days.map((day) => (
            <View
              key={dateKey(day)}
              style={{
                width: dayWidth,
                padding: 4,
                gap: 4,
                borderLeftWidth: 1,
                borderColor: theme.line,
              }}
            >
              {eventsForDay(events, day)
                .filter((event) => event.allDay)
                .map((event) => (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.title}, all day, ${format(day, 'MMM d')}`}
                    onPress={() => onOpenEvent(event)}
                    style={{
                      padding: 8,
                      minHeight: 44,
                      borderRadius: 6,
                      backgroundColor: theme.accentSoft,
                      borderLeftWidth: 3,
                      borderLeftColor:
                        calendars.find((calendar) => calendar.id === event.calendarId)?.color ??
                        theme.accent,
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}
                    >
                      {event.title}
                    </Text>
                  </Pressable>
                ))}
              {!eventsForDay(events, day).some((event) => event.allDay) && (
                <Text
                  accessibilityLabel="No all-day events"
                  style={{ color: theme.muted, padding: 8 }}
                >
                  —
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        <ScrollView
          ref={vertical}
          nestedScrollEnabled
          style={{ flex: 1 }}
          contentContainerStyle={{ height: 1440 * MINUTE_HEIGHT + 20, width: totalWidth }}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <View
              key={hour}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: hour * 60 * MINUTE_HEIGHT,
                width: totalWidth,
                height: 60 * MINUTE_HEIGHT,
                flexDirection: 'row',
              }}
            >
              <Text
                style={{
                  width: GUTTER,
                  textAlign: 'center',
                  color: theme.muted,
                  fontSize: 10,
                  paddingTop: 2,
                }}
              >{`${String(hour).padStart(2, '0')}:00`}</Text>
              <View style={{ flex: 1, borderTopWidth: 1, borderColor: theme.border }} />
            </View>
          ))}
          {days.map((day, dayIndex) => (
            <View
              key={dateKey(day)}
              style={{
                position: 'absolute',
                left: GUTTER + dayIndex * dayWidth,
                width: dayWidth,
                top: 0,
                height: 1440 * MINUTE_HEIGHT,
                borderLeftWidth: 1,
                borderColor: theme.line,
              }}
            >
              {layoutEvents(events, day).map(
                ({ event, startMinute, endMinute, column, columnCount, columnSpan }) => (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.title}, ${eventTime(event)}, ${format(day, 'EEEE MMMM d')}. ${calendars.find((calendar) => calendar.id === event.calendarId)?.title ?? ''}`}
                    onPress={() => onOpenEvent(event)}
                    style={({ pressed }) => ({
                      position: 'absolute',
                      top: startMinute * MINUTE_HEIGHT,
                      height: Math.max(18, (endMinute - startMinute) * MINUTE_HEIGHT - 2),
                      left: (column * (dayWidth - 4)) / columnCount + 2,
                      width: Math.max(8, (columnSpan * (dayWidth - 4)) / columnCount - 2),
                      borderRadius: 6,
                      overflow: 'hidden',
                      padding: 4,
                      borderLeftWidth: 3,
                      borderLeftColor:
                        calendars.find((calendar) => calendar.id === event.calendarId)?.color ??
                        theme.accent,
                      backgroundColor: theme.accentSoft,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Text
                      numberOfLines={Math.max(1, Math.floor((endMinute - startMinute) / 20))}
                      style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}
                    >
                      {event.title}
                    </Text>
                    {endMinute - startMinute >= 45 && (
                      <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 10 }}>
                        {eventTime(event)}
                      </Text>
                    )}
                  </Pressable>
                ),
              )}
              {dateKey(day) === dateKey(now) && (
                <View
                  pointerEvents="none"
                  accessibilityLabel={`Current time ${format(now, 'HH:mm')}`}
                  style={{
                    position: 'absolute',
                    top: currentMinute * MINUTE_HEIGHT,
                    width: dayWidth,
                    height: 2,
                    backgroundColor: theme.today,
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      marginTop: -2.5,
                      borderRadius: 4,
                      backgroundColor: theme.today,
                    }}
                  />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}
