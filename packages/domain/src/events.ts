import { addDays, startOfDay } from 'date-fns';
import { parseDate } from './dates';
import type { CalendarEvent } from './types';

export interface EventLayout {
  event: CalendarEvent;
  startMinute: number;
  endMinute: number;
  column: number;
  columnCount: number;
  columnSpan: number;
}

interface EventInterval {
  event: CalendarEvent;
  start: Date;
  end: Date;
  index: number;
}

function dayBounds(day: Date): { start: Date; end: Date } {
  if (!Number.isFinite(+day)) throw new RangeError('Expected a valid day');
  const start = startOfDay(day);
  return { start, end: addDays(start, 1) };
}

function intersectingEvents(events: CalendarEvent[], start: Date, end: Date): EventInterval[] {
  const intervals: EventInterval[] = [];
  events.forEach((event, index) => {
    // A malformed provider record should not prevent the rest of the day rendering.
    let eventStart: Date;
    let eventEnd: Date;
    try {
      eventStart = parseDate(event.start);
      eventEnd = parseDate(event.end);
    } catch {
      return;
    }
    if (eventStart < eventEnd && eventStart < end && eventEnd > start) {
      intervals.push({ event, start: eventStart, end: eventEnd, index });
    }
  });
  return intervals;
}

/** Membership uses instants, including across DST; all-day dates parse locally. */
export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const { start, end } = dayBounds(day);
  return intersectingEvents(events, start, end)
    .sort(
      (a, b) =>
        Number(b.event.allDay) - Number(a.event.allDay) || +a.start - +b.start || a.index - b.index,
    )
    .map(({ event }) => event);
}

function wallMinute(date: Date): number {
  return (
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60 +
    date.getMilliseconds() / 60_000
  );
}

function collides(a: EventLayout, b: EventLayout): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

function layoutGroup(group: EventLayout[]): void {
  const columns: EventLayout[][] = [];
  for (const item of group) {
    let column = columns.findIndex((entries) => {
      const last = entries[entries.length - 1];
      return last !== undefined && last.endMinute <= item.startMinute;
    });
    if (column === -1) {
      column = columns.length;
      columns.push([]);
    }
    item.column = column;
    columns[column]!.push(item);
  }
  for (const item of group) {
    item.columnCount = columns.length;
    // Expand through every contiguous free column, not merely the next one.
    for (let column = item.column + 1; column < columns.length; column += 1) {
      if (columns[column]!.some((other) => collides(item, other))) break;
      item.columnSpan += 1;
    }
  }
}

/**
 * Timed events on a fixed 24-hour local wall-clock axis. Repeated fall-back hours
 * share visual coordinates. A positive interval whose end folds behind its start
 * is drawn as one minute (clamped to midnight); see README for this tradeoff.
 * Input records are never mutated or deduplicated.
 */
export function layoutEvents(events: CalendarEvent[], day: Date): EventLayout[] {
  const { start, end } = dayBounds(day);
  const items = intersectingEvents(events, start, end)
    .filter(({ event }) => !event.allDay)
    .map(({ event, start: eventStart, end: eventEnd, index }) => {
      const startMinute = eventStart <= start ? 0 : wallMinute(eventStart);
      const wallEnd = eventEnd >= end ? 1440 : wallMinute(eventEnd);
      const endMinute = wallEnd > startMinute ? wallEnd : Math.min(1440, startMinute + 1);
      return {
        index,
        layout: { event, startMinute, endMinute, column: 0, columnCount: 1, columnSpan: 1 },
      };
    })
    .sort(
      (a, b) =>
        a.layout.startMinute - b.layout.startMinute ||
        b.layout.endMinute - a.layout.endMinute ||
        a.index - b.index,
    )
    .map(({ layout }) => layout);

  let group: EventLayout[] = [];
  let groupEnd = -Infinity;
  for (const item of items) {
    if (item.startMinute >= groupEnd && group.length > 0) {
      layoutGroup(group);
      group = [];
    }
    group.push(item);
    groupEnd = Math.max(group.length === 1 ? -Infinity : groupEnd, item.endMinute);
  }
  if (group.length > 0) layoutGroup(group);
  return items;
}
