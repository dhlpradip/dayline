import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { format, isSameMonth } from 'date-fns';
import { dateKey, datesInRange, monthRange } from '@dayline/domain';
import { eventDensity } from '../event-density';
import type { CalendarViewProps } from '../use-calendar';
import { Body } from '../components/ui';
import { useTheme } from '../theme';

export function YearView({ selectedDate, events, range, onSelectDay }: CalendarViewProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 3 : 2;
  const counts = useMemo(() => eventDensity(events, range), [events, range]);
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      <View style={{ padding: 6, paddingBottom: 18 }}>
        <Body>
          Tap a month to explore. Shading shows daily event density: light 1–2, medium 3–5, strong
          6+. No shading means no events.
        </Body>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from(
          { length: 12 },
          (_, index) => new Date(selectedDate.getFullYear(), index, 1),
        ).map((month) => {
          const days = datesInRange(monthRange(month));
          const count = days
            .filter((day) => isSameMonth(day, month))
            .reduce((sum, day) => sum + (counts.get(dateKey(day)) ?? 0), 0);
          return (
            <Pressable
              key={month.getMonth()}
              accessibilityRole="button"
              accessibilityLabel={`${format(month, 'MMMM yyyy')}, ${count} event-days. Open month.`}
              onPress={() => onSelectDay(month)}
              style={{ width: `${100 / columns}%`, padding: 5 }}
            >
              <View
                style={{
                  borderRadius: 16,
                  padding: 10,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  gap: 9,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>
                  {format(month, 'MMMM')}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                    <Text
                      key={index}
                      style={{
                        width: `${100 / 7}%`,
                        textAlign: 'center',
                        fontSize: 9,
                        color: theme.muted,
                      }}
                    >
                      {day}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 132 }}>
                  {days.map((day) => {
                    const inMonth = isSameMonth(day, month);
                    const density = inMonth ? (counts.get(dateKey(day)) ?? 0) : 0;
                    return (
                      <View
                        key={dateKey(day)}
                        style={{ width: `${100 / 7}%`, height: 22, padding: 1 }}
                      >
                        <View
                          style={{
                            flex: 1,
                            borderRadius: 4,
                            justifyContent: 'center',
                            backgroundColor:
                              density >= 6
                                ? theme.accent
                                : density >= 3
                                  ? theme.border
                                  : density
                                    ? theme.accentSoft
                                    : 'transparent',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              textAlign: 'center',
                              color: density >= 6 ? theme.onAccent : theme.text,
                            }}
                          >
                            {inMonth ? day.getDate() : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
