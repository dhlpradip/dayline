import {
  addDays,
  addMonths,
  addYears,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { DateRange } from './types';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'year';

function assertDate(date: Date): void {
  if (!isValid(date)) throw new RangeError('Expected a valid date');
}

/** Local civil date, independent of the UTC date at the same instant. */
export function dateKey(date: Date): string {
  assertDate(date);
  return format(date, 'yyyy-MM-dd');
}

/** Civil date in an explicit IANA timezone, without changing the instant. */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  assertDate(date);
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}

/** ISO values without an offset (including YYYY-MM-DD) are interpreted locally. */
export function parseDate(value: string): Date {
  const date = parseISO(value);
  if (!isValid(date)) throw new RangeError(`Invalid ISO date: ${value}`);
  return date;
}

/** The smallest Monday-aligned, whole-week grid containing the month. */
export function monthRange(date: Date): DateRange {
  assertDate(date);
  const monthStart = startOfMonth(date);
  const nextMonth = addMonths(monthStart, 1);
  const finalWeekStart = startOfWeek(addDays(nextMonth, -1), { weekStartsOn: 1 });
  return {
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: addDays(finalWeekStart, 7),
  };
}

/** `days` overrides only week/agenda lengths; all ends are exclusive. */
export function visibleRange(date: Date, view: CalendarView, days?: number): DateRange {
  assertDate(date);
  if (view === 'month') return monthRange(date);
  if (view === 'year') {
    const start = startOfYear(date);
    return { start, end: addYears(start, 1) };
  }
  const length = view === 'day' ? 1 : (days ?? (view === 'week' ? 7 : 30));
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError('Range days must be a positive safe integer');
  }
  const start = startOfDay(date);
  const end = addDays(start, length);
  assertDate(end);
  return { start, end };
}

/** Local midnights for days intersecting [start, end); an empty range has no days. */
export function datesInRange(range: DateRange): Date[] {
  assertDate(range.start);
  assertDate(range.end);
  if (range.end < range.start) throw new RangeError('Range end must not precede start');
  if (+range.start === +range.end) return [];
  const dates: Date[] = [];
  for (let day = startOfDay(range.start); day < range.end; day = addDays(day, 1)) {
    dates.push(day);
  }
  return dates;
}
