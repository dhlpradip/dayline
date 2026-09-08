import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visibleRange, type CalendarEvent, type DateRange } from '@dayline/domain';
import { useCalendarServices } from './calendar-context';
import { localProvider } from './database';
import { CalendarAccessError } from './apple-provider';
import { usePreferences } from './preferences';

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  a.start.localeCompare(b.start) || a.id.localeCompare(b.id);
export function useCalendarData(selectedDate: Date) {
  const { access, epoch, apple, checkAccess } = useCalendarServices();
  const { view, dayCount, hiddenCalendars } = usePreferences();
  const range = useMemo(
    () => visibleRange(selectedDate, view, view === 'week' ? dayCount : undefined),
    [selectedDate, view, dayCount],
  );
  const localCalendars = useQuery({
    queryKey: ['calendar-data', 'local', 'calendars'],
    queryFn: () => localProvider.getCalendars(),
  });
  const systemCalendars = useQuery({
    queryKey: ['calendar-data', 'system', access, epoch, 'calendars'],
    enabled: access === 'granted',
    queryFn: async ({ signal }) => {
      const value = await apple.getCalendars();
      if (signal.aborted) throw new Error('Calendar read cancelled.');
      return value;
    },
  });
  const calendars = [
    ...(localCalendars.data ?? []),
    ...(access === 'granted' ? (systemCalendars.data ?? []) : []),
  ];
  const localIds = (localCalendars.data ?? [])
    .map((calendar) => calendar.id)
    .filter((id) => !hiddenCalendars.includes(id))
    .sort();
  const systemIds = (access === 'granted' ? (systemCalendars.data ?? []) : [])
    .map((calendar) => calendar.id)
    .filter((id) => !hiddenCalendars.includes(id))
    .sort();
  const boundaries = [range.start.toISOString(), range.end.toISOString()];
  const localEvents = useQuery({
    queryKey: ['calendar-data', 'local', 'events', localIds, ...boundaries],
    enabled: localCalendars.isSuccess,
    queryFn: () => localProvider.getEvents(range, localIds),
  });
  const systemEvents = useQuery({
    queryKey: ['calendar-data', 'system', access, epoch, 'events', systemIds, ...boundaries],
    enabled: access === 'granted' && systemCalendars.isSuccess,
    queryFn: async ({ signal }) => {
      const value = await apple.getEvents(range, systemIds);
      if (signal.aborted) throw new Error('Calendar read cancelled.');
      return value;
    },
  });
  const systemError = systemCalendars.error ?? systemEvents.error;
  useEffect(() => {
    if (systemError instanceof CalendarAccessError) void checkAccess();
  }, [systemError, checkAccess]);
  const events = useMemo(
    () =>
      [
        ...(localEvents.data ?? []),
        ...(access === 'granted' ? (systemEvents.data ?? []) : []),
      ].sort(byStart),
    [localEvents.data, systemEvents.data, access],
  );
  return {
    events,
    calendars,
    range,
    loading:
      localCalendars.isPending ||
      localEvents.isFetching ||
      access === 'checking' ||
      (access === 'granted' && (systemCalendars.isPending || systemEvents.isFetching)),
    localError: localCalendars.error ?? localEvents.error,
    systemError: access === 'granted' ? systemError : null,
    allHidden:
      calendars.length > 0 && calendars.every((calendar) => hiddenCalendars.includes(calendar.id)),
  };
}
export type CalendarData = ReturnType<typeof useCalendarData>;
export interface CalendarViewProps {
  events: CalendarEvent[];
  calendars: CalendarData['calendars'];
  selectedDate: Date;
  range: DateRange;
  onSelectDay(day: Date): void;
  onOpenEvent(event: CalendarEvent): void;
}
