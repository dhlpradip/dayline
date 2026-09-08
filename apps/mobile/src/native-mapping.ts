import { dateKey, parseDate, type Calendar, type CalendarEvent } from '@dayline/domain';

/** Structural projections of Expo SDK57 shared objects; safe to test without loading native code. */
export interface NativeCalendar {
  id: string;
  title: string;
  color?: string;
  source: { name?: string };
  allowsModifications: boolean;
}
export interface NativeEvent {
  id: string;
  calendarId: string;
  title: string;
  startDate: string | Date;
  endDate: string | Date;
  allDay: boolean;
  /** Native TimeZone.identifier, never a localized label; enforced by the expo-calendar pnpm patch. */
  timeZone?: string | null;
  notes?: string | null;
  location?: string | null;
  url?: string | null;
  recurrenceRule?: unknown;
  originalStartDate?: string | Date;
  isDetached?: boolean;
  status?: string;
}
export const systemCalendarId = (id: string): string => `apple-system:${id}`;

function eventDate(value: string | Date, allDay: boolean, timeZone?: string | null): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!Number.isFinite(date.getTime())) throw new Error('The calendar returned an invalid date.');
  if (!allDay) return date.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // The patched SDK57 getter supplies TimeZone.identifier (ADR 002). A localized label such
  // as EST can be accepted by Intl but lose New York's summer offset. Never infer a zone from it.
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  // Only genuinely floating events without a source timezone use the device's civil date.
  // Invalid non-empty identifiers throw rather than silently changing the event's dates.
  return dateKey(date);
}

export function mapCalendar(calendar: NativeCalendar): Calendar {
  return {
    id: systemCalendarId(calendar.id),
    externalId: calendar.id,
    providerId: 'apple-system',
    title: calendar.title || 'Untitled calendar',
    color: calendar.color || '#5265D9',
    source: calendar.source?.name || 'Apple Calendar',
    readOnly: !calendar.allowsModifications,
    allowsModifications: calendar.allowsModifications,
  };
}

export function mapEvent(event: NativeEvent): CalendarEvent {
  const start = eventDate(event.startDate, event.allDay, event.timeZone);
  const end = eventDate(event.endDate, event.allDay, event.timeZone);
  const originalStart = event.originalStartDate ? eventDate(event.originalStartDate, false) : null;
  // EventKit can reuse the same identifier for every occurrence. Include the displayed interval
  // as well as originalStart (whose semantics vary for detached instances).
  const id = JSON.stringify([
    'apple-system',
    event.calendarId,
    event.id,
    start,
    end,
    originalStart,
  ]);
  return {
    id,
    externalId: event.id,
    providerId: 'apple-system',
    calendarId: systemCalendarId(event.calendarId),
    title: event.title || 'Untitled event',
    description: event.notes || null,
    start,
    end,
    allDay: event.allDay,
    timezone: event.timeZone || null,
    location: event.location || null,
    url: event.url || null,
    recurring: !!event.recurrenceRule || !!event.isDetached || !!originalStart,
    originalStart,
    status: event.status || null,
  };
}

export function occurrenceRange(id: string): { calendarId: string; start: Date; end: Date } | null {
  try {
    const parts: unknown = JSON.parse(id);
    if (
      !Array.isArray(parts) ||
      parts.length !== 6 ||
      parts[0] !== 'apple-system' ||
      typeof parts[1] !== 'string' ||
      typeof parts[3] !== 'string' ||
      typeof parts[4] !== 'string'
    )
      return null;
    const start = parseDate(parts[3]);
    const end = parseDate(parts[4]);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
    // Include an extra local day around the interval to handle civil dates/timezone differences.
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    return { calendarId: parts[1], start, end };
  } catch {
    return null;
  }
}
