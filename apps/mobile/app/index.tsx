import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { addDays, addMonths, addYears, format } from 'date-fns';
import { type CalendarEvent } from '@dayline/domain';
import { PRODUCT } from '@dayline/config';
import { useTheme } from '../src/theme';
import { usePreferences, views, type CalendarView } from '../src/preferences';
import { persistPreferences } from '../src/database';
import { useCalendarData } from '../src/use-calendar';
import { useCalendarServices } from '../src/calendar-context';
import { retainEvent } from '../src/event-navigation';
import { Button, Body, Notice } from '../src/components/ui';
import { PermissionPanel } from '../src/components/permission-panel';
import { CalendarFilter } from '../src/components/calendar-filter';
import { MonthView } from '../src/views/month';
import { TimelineView } from '../src/views/timeline';
import { AgendaView } from '../src/views/agenda';
import { YearView } from '../src/views/year';

const viewLabels: Record<CalendarView, string> = {
  month: 'Month',
  week: 'Timeline',
  day: 'Day',
  agenda: 'Agenda',
  year: 'Year',
};
export default function CalendarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [filterOpen, setFilterOpen] = useState(false);
  const { view, dayCount, update, saveError } = usePreferences();
  const { access, refresh } = useCalendarServices();
  const data = useCalendarData(selectedDate);
  const changeView = (next: CalendarView) => {
    update({ view: next });
    void persistPreferences();
  };
  const navigate = (direction: number) =>
    setSelectedDate((date) =>
      view === 'month'
        ? addMonths(date, direction)
        : view === 'year'
          ? addYears(date, direction)
          : addDays(date, direction * (view === 'week' ? dayCount : view === 'agenda' ? 30 : 1)),
    );
  const openEvent = (event: CalendarEvent) =>
    router.push({ pathname: '/event/[token]', params: { token: retainEvent(event) } });
  const props = {
    events: data.events,
    calendars: data.calendars,
    range: data.range,
    selectedDate,
    onSelectDay: setSelectedDate,
    onOpenEvent: openEvent,
  };
  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={{ paddingHorizontal: 18, paddingTop: 10, gap: 3 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: theme.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}
            >
              {PRODUCT.name.toUpperCase()}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ color: theme.text, fontSize: 27, fontWeight: '700', marginTop: 5 }}
            >
              {format(selectedDate, view === 'year' ? 'yyyy' : 'MMMM yyyy')}
            </Text>
          </View>
          <Button label="Calendars" onPress={() => setFilterOpen(true)} />
        </View>
        <Text style={{ color: theme.muted, fontSize: 12 }}>
          {access === 'granted'
            ? 'Apple Calendar + on-device · Read-only'
            : 'On-device · No account needed'}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 2 }}
        >
          {views.map((item) => (
            <Button
              key={item}
              label={viewLabels[item]}
              selected={view === item}
              onPress={() => changeView(item)}
            />
          ))}
        </ScrollView>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Button
              label="‹"
              accessibilityLabel={`Previous ${view === 'week' ? `${dayCount} days` : view === 'agenda' ? '30 days' : view}`}
              onPress={() => navigate(-1)}
            />
            <Button label="Today" onPress={() => setSelectedDate(new Date())} />
            <Button
              label="›"
              accessibilityLabel={`Next ${view === 'week' ? `${dayCount} days` : view === 'agenda' ? '30 days' : view}`}
              onPress={() => navigate(1)}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {data.loading && (
              <ActivityIndicator
                size="small"
                color={theme.accent}
                accessibilityLabel="Loading calendars"
              />
            )}
            <Button
              label="Refresh"
              disabled={access === 'checking'}
              onPress={() => {
                void refresh();
              }}
            />
          </View>
        </View>
        {view === 'week' && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ color: theme.muted, fontSize: 13, paddingLeft: 10 }}>
              {format(selectedDate, 'EEE, MMM d')} · {dayCount} days
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Button
                label="−"
                accessibilityLabel="Show fewer days"
                disabled={dayCount <= 1}
                onPress={() => {
                  update({ dayCount: dayCount - 1 });
                  void persistPreferences();
                }}
              />
              <Text style={{ color: theme.text, fontSize: 14 }}>{dayCount}</Text>
              <Button
                label="+"
                accessibilityLabel="Show more days"
                disabled={dayCount >= 14}
                onPress={() => {
                  update({ dayCount: dayCount + 1 });
                  void persistPreferences();
                }}
              />
            </View>
          </View>
        )}
      </View>
      <PermissionPanel />
      {saveError && (
        <Notice title="Preferences could not be saved" error>
          <Body>Your selection works for this session. Retry to keep it after restarting.</Body>
          <Button
            label="Retry saving"
            onPress={() => {
              void persistPreferences();
            }}
          />
        </Notice>
      )}
      {(data.localError || data.systemError) && (
        <Notice
          title={
            data.localError
              ? 'Local calendar could not be read'
              : 'Apple calendars could not be refreshed'
          }
          error
        >
          <Body>
            {data.localError
              ? 'Your local data has not been reset.'
              : 'Local browsing is still available. Check calendar access and try again.'}
          </Body>
          <Button
            label="Retry"
            onPress={() => {
              void refresh();
            }}
          />
        </Notice>
      )}
      {data.allHidden && (
        <Notice title="All calendars are hidden">
          <Button label="Choose visible calendars" onPress={() => setFilterOpen(true)} />
        </Notice>
      )}
      {!data.allHidden &&
        !data.loading &&
        !data.localError &&
        !data.systemError &&
        data.events.length === 0 &&
        view !== 'agenda' && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
            <Body>
              No events in this range.{' '}
              {access === 'granted'
                ? 'Choose calendars or try another date.'
                : 'Your local calendar is empty; creating events is deferred.'}
            </Body>
          </View>
        )}
      <View style={{ flex: 1 }}>
        {view === 'month' ? (
          <MonthView {...props} />
        ) : view === 'year' ? (
          <YearView
            {...props}
            onSelectDay={(day) => {
              setSelectedDate(day);
              changeView('month');
            }}
          />
        ) : view === 'agenda' ? (
          <AgendaView {...props} />
        ) : (
          <TimelineView {...props} />
        )}
      </View>
      <CalendarFilter
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        calendars={data.calendars}
      />
    </SafeAreaView>
  );
}
