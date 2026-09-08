import { SectionList, Text, View } from 'react-native';
import { format, isToday } from 'date-fns';
import { dateKey, datesInRange, eventsForDay } from '@dayline/domain';
import type { CalendarViewProps } from '../use-calendar';
import { EventRow } from '../components/event-row';
import { Body } from '../components/ui';
import { useTheme } from '../theme';

export function AgendaView({ range, events, calendars, onOpenEvent }: CalendarViewProps) {
  const theme = useTheme();
  const sections = datesInRange(range)
    .map((day) => ({ key: dateKey(day), day, data: eventsForDay(events, day) }))
    .filter((section) => section.data.length);
  return (
    <SectionList
      sections={sections}
      keyExtractor={(event) => event.id}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      stickySectionHeadersEnabled
      contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      renderSectionHeader={({ section }) => (
        <View
          style={{ backgroundColor: theme.background, paddingHorizontal: 18, paddingVertical: 12 }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: isToday(section.day) ? theme.today : theme.text,
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            {isToday(section.day) ? 'Today · ' : ''}
            {format(section.day, 'EEEE, MMMM d')}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <EventRow event={item} calendars={calendars} onPress={() => onOpenEvent(item)} />
      )}
      ListHeaderComponent={
        <View style={{ padding: 18 }}>
          <Body>Next 30 days · {format(range.start, 'MMM d')} onward</Body>
        </View>
      }
      ListEmptyComponent={
        <View style={{ padding: 24, gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>
            Room in your schedule
          </Text>
          <Body>No events in the next 30 days for the visible calendars.</Body>
        </View>
      }
    />
  );
}
