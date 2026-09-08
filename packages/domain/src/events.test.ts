import { describe, expect, it } from 'vitest';
import { eventsForDay, layoutEvents, parseDate } from './index';
import type { CalendarEvent, EventLayout } from './index';

function event(
  id: string,
  start: string,
  end: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    externalId: id,
    providerId: 'dayline-local',
    calendarId: 'personal',
    title: id,
    description: null,
    start,
    end,
    allDay: false,
    timezone: null,
    location: null,
    url: null,
    recurring: false,
    originalStart: null,
    status: null,
    ...overrides,
  };
}

const day = parseDate('2024-01-15');
function timed(
  id: string,
  start: string,
  end: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return event(id, `2024-01-15T${start}:00-05:00`, `2024-01-15T${end}:00-05:00`, overrides);
}
function geometry(items: EventLayout[]) {
  return items.map(({ event: item, ...layout }) => ({ id: item.id, ...layout }));
}

describe('eventsForDay', () => {
  it('uses exclusive ends for all-day events, including a leap day', () => {
    const holiday = event('holiday', '2024-02-28', '2024-03-01', { allDay: true });
    expect(eventsForDay([holiday], parseDate('2024-02-27'))).toEqual([]);
    expect(eventsForDay([holiday], parseDate('2024-02-28'))).toEqual([holiday]);
    expect(eventsForDay([holiday], parseDate('2024-02-29'))).toEqual([holiday]);
    expect(eventsForDay([holiday], parseDate('2024-03-01'))).toEqual([]);
  });

  it('excludes events ending at this midnight or starting at the next midnight', () => {
    const yesterday = event('yesterday', '2024-01-14T23:00:00-05:00', '2024-01-15T00:00:00-05:00');
    const tomorrow = event('tomorrow', '2024-01-16T00:00:00-05:00', '2024-01-16T01:00:00-05:00');
    const overnight = event('overnight', '2024-01-14T23:00:00-05:00', '2024-01-15T01:00:00-05:00');
    const toMidnight = event(
      'to-midnight',
      '2024-01-15T23:00:00-05:00',
      '2024-01-16T00:00:00-05:00',
    );
    expect(eventsForDay([yesterday, tomorrow, toMidnight, overnight], day)).toEqual([
      overnight,
      toMidnight,
    ]);
  });

  it('sorts all-day first, then by start instant, preserving ties and input records', () => {
    const late = timed('late', '15:00', '16:00');
    const early = timed('early', '09:00', '10:00');
    const tie = timed('tie', '09:00', '11:00');
    const allDay = event('all-day', '2024-01-15', '2024-01-16', { allDay: true });
    const earlierAllDay = event('multi-day', '2024-01-14', '2024-01-16', { allDay: true });
    const input = [late, early, tie, allDay, earlierAllDay];
    const copy = structuredClone(input);
    input.forEach(Object.freeze);
    Object.freeze(input);
    expect(eventsForDay(input, day)).toEqual([earlierAllDay, allDay, early, tie, late]);
    expect(input).toEqual(copy);
  });

  it('keeps recurring instances, even when a provider reuses an event ID', () => {
    const first = timed('series', '09:00', '10:00', {
      recurring: true,
      originalStart: '2024-01-15T14:00:00Z',
    });
    const second = timed('series', '11:00', '12:00', {
      recurring: true,
      originalStart: '2024-01-16T14:00:00Z',
    });
    expect(eventsForDay([second, first], day)).toEqual([first, second]);
    expect(layoutEvents([second, first], day).map((item) => item.event)).toEqual([first, second]);
    expect(layoutEvents([first, first], day)).toHaveLength(2);
  });

  it('ignores malformed, reversed, and zero-duration records', () => {
    const valid = timed('valid', '09:00', '10:00');
    const input = [
      valid,
      timed('zero', '09:00', '09:00'),
      timed('reversed', '10:00', '09:00'),
      event('bad-start', 'not-a-date', valid.end),
      event('bad-end', valid.start, '2024-02-30'),
    ];
    expect(eventsForDay(input, day)).toEqual([valid]);
    expect(layoutEvents(input, day).map((item) => item.event)).toEqual([valid]);
    expect(() => eventsForDay(input, new Date(NaN))).toThrow(RangeError);
    expect(() => layoutEvents(input, new Date(NaN))).toThrow(RangeError);
  });
});

describe('layoutEvents', () => {
  it('ignores all-day/out-of-day events and does not mutate inputs', () => {
    const input = [
      timed('timed', '09:00', '10:00'),
      event('all-day', '2024-01-15', '2024-01-16', { allDay: true }),
      event('tomorrow', '2024-01-16T09:00:00-05:00', '2024-01-16T10:00:00-05:00'),
    ];
    const copy = structuredClone(input);
    input.forEach(Object.freeze);
    Object.freeze(input);
    const before = +day;
    expect(geometry(layoutEvents(input, day))).toEqual([
      { id: 'timed', startMinute: 540, endMinute: 600, column: 0, columnCount: 1, columnSpan: 1 },
    ]);
    expect(input).toEqual(copy);
    expect(+day).toBe(before);
    expect(layoutEvents([], day)).toEqual([]);
  });

  it('keeps transitive collision groups together, using peak concurrency not group size', () => {
    const input = [
      timed('c', '10:30', '12:00'),
      timed('a', '09:00', '10:00'),
      timed('b', '09:30', '11:00'),
    ];
    const result = layoutEvents(input, day);
    expect(result.map((item) => item.event.id)).toEqual(['a', 'b', 'c']);
    expect(result.map((item) => item.column)).toEqual([0, 1, 0]);
    expect(result.map((item) => item.columnCount)).toEqual([2, 2, 2]);
  });

  it('does not collide touching events and resets widths for independent groups', () => {
    const result = layoutEvents(
      [
        timed('a', '09:00', '10:00'),
        timed('b', '09:15', '10:00'),
        timed('c', '10:00', '11:00'),
        timed('d', '11:00', '12:00'),
      ],
      day,
    );
    expect(result.map((item) => [item.column, item.columnCount, item.columnSpan])).toEqual([
      [0, 2, 1],
      [1, 2, 1],
      [0, 1, 1],
      [0, 1, 1],
    ]);
  });

  it('maximizes width across multiple contiguous free columns', () => {
    const result = layoutEvents(
      [
        timed('a', '09:00', '12:00'),
        timed('b', '09:00', '10:00'),
        timed('c', '09:00', '09:30'),
        timed('d', '09:15', '09:45'),
        timed('wide', '10:00', '11:00'),
      ],
      day,
    );
    expect(result.every((item) => item.columnCount === 4)).toBe(true);
    expect(result.find((item) => item.event.id === 'wide')).toMatchObject({
      column: 1,
      columnSpan: 3,
    });
  });

  it('checks future collisions before expanding into a column', () => {
    const result = layoutEvents(
      [
        timed('anchor', '09:00', '12:00'),
        timed('early', '09:00', '10:00'),
        timed('short', '09:00', '09:30'),
        timed('middle', '10:00', '11:00'),
        timed('future', '10:30', '11:30'),
      ],
      day,
    );
    expect(result.find((item) => item.event.id === 'middle')).toMatchObject({
      column: 1,
      columnCount: 3,
      columnSpan: 1,
    });
  });

  it('clips cross-midnight and multi-day events to 0..1440', () => {
    const overnight = event('overnight', '2024-01-14T23:00:00-05:00', '2024-01-15T02:00:00-05:00');
    const late = event('late', '2024-01-15T23:00:00-05:00', '2024-01-16T02:00:00-05:00');
    const spanning = event('spanning', '2024-01-14T23:00:00-05:00', '2024-01-17T02:00:00-05:00');
    expect(layoutEvents([overnight], day)[0]).toMatchObject({ startMinute: 0, endMinute: 120 });
    expect(layoutEvents([late], day)[0]).toMatchObject({ startMinute: 1380, endMinute: 1440 });
    expect(layoutEvents([spanning], day)[0]).toMatchObject({ startMinute: 0, endMinute: 1440 });
    expect(layoutEvents([overnight], parseDate('2024-01-14'))[0]).toMatchObject({
      startMinute: 1380,
      endMinute: 1440,
    });
  });

  it('preserves sub-minute boundaries and their exclusive touching behavior', () => {
    const a = event('a', '2024-01-15T09:00:30.000-05:00', '2024-01-15T09:01:15.000-05:00');
    const b = event('b', a.end, '2024-01-15T09:02:00.000-05:00');
    const result = layoutEvents([a, b], day);
    expect(result[0]).toMatchObject({ startMinute: 540.5, endMinute: 541.25, columnCount: 1 });
    expect(result[1]).toMatchObject({ startMinute: 541.25, columnCount: 1 });
  });

  it('maintains collision and maximal-right-expansion invariants for dense schedules', () => {
    let seed = 37;
    function random(): number {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    }
    for (let trial = 0; trial < 20; trial += 1) {
      const input = Array.from({ length: 40 }, (_, index) => {
        const start = Math.floor(random() * 1380);
        const end = Math.min(1440, start + 1 + Math.floor(random() * 240));
        return event(
          String(index),
          new Date(+day + start * 60_000).toISOString(),
          new Date(+day + end * 60_000).toISOString(),
        );
      });
      const result = layoutEvents(input, day);
      expect(result).toHaveLength(input.length);
      for (const item of result) {
        expect(item.columnSpan).toBeGreaterThanOrEqual(1);
        expect(item.column + item.columnSpan).toBeLessThanOrEqual(item.columnCount);
        const overlaps = result.filter(
          (other) =>
            other !== item &&
            item.startMinute < other.endMinute &&
            other.startMinute < item.endMinute,
        );
        for (const other of overlaps) {
          expect(item.columnCount).toBe(other.columnCount);
          expect(
            item.column + item.columnSpan <= other.column ||
              other.column + other.columnSpan <= item.column,
          ).toBe(true);
        }
        const nextColumn = item.column + item.columnSpan;
        if (nextColumn < item.columnCount) {
          expect(overlaps.some((other) => other.column === nextColumn)).toBe(true);
        }
      }
    }
  });
});

describe('DST membership and visual tradeoffs', () => {
  it('uses wall-clock positions, not elapsed minutes, across the spring gap', () => {
    const springDay = parseDate('2024-03-10');
    const crossing = event('crossing', '2024-03-10T01:30:00-05:00', '2024-03-10T03:30:00-04:00');
    const late = event('late', '2024-03-10T23:00:00-04:00', '2024-03-11T00:00:00-04:00');
    expect(eventsForDay([crossing, late], springDay)).toEqual([crossing, late]);
    expect(layoutEvents([crossing, late], springDay)).toMatchObject([
      { startMinute: 90, endMinute: 210 },
      { startMinute: 1380, endMinute: 1440 },
    ]);
    expect(eventsForDay([late], parseDate('2024-03-11'))).toEqual([]);
  });

  it('keeps both fall-back occurrences, with coincident visual columns', () => {
    const fallDay = parseDate('2024-11-03');
    const first = event('first', '2024-11-03T01:15:00-04:00', '2024-11-03T01:45:00-04:00');
    const second = event('second', '2024-11-03T01:15:00-05:00', '2024-11-03T01:45:00-05:00');
    expect(eventsForDay([second, first], fallDay)).toEqual([first, second]);
    const result = layoutEvents([first, second], fallDay);
    expect(result).toMatchObject([
      { startMinute: 75, endMinute: 105, column: 0, columnCount: 2 },
      { startMinute: 75, endMinute: 105, column: 1, columnCount: 2 },
    ]);
  });

  it.each([
    ['2024-11-03T01:50:00-04:00', '2024-11-03T01:10:00-05:00', 110, 111],
    ['2024-11-03T01:30:00-04:00', '2024-11-03T01:30:00-05:00', 90, 91],
  ] as const)(
    'retains a positive instant interval whose visual end folds backward/equal',
    (start, end, startMinute, endMinute) => {
      const folding = event('folding', start, end);
      const fallDay = parseDate('2024-11-03');
      expect(eventsForDay([folding], fallDay)).toEqual([folding]);
      expect(layoutEvents([folding], fallDay)[0]).toMatchObject({ startMinute, endMinute });
    },
  );

  it('includes the last hour of a 25-hour day, regardless of event timezone metadata', () => {
    const late = event('late', '2024-11-04T04:30:00Z', '2024-11-04T05:00:00Z', {
      timezone: 'Asia/Tokyo',
    });
    expect(eventsForDay([late], parseDate('2024-11-03'))).toEqual([late]);
    expect(layoutEvents([late], parseDate('2024-11-03'))[0]).toMatchObject({
      startMinute: 1410,
      endMinute: 1440,
    });
    expect(eventsForDay([late], parseDate('2024-11-04'))).toEqual([]);
  });

  it.each([
    ['2024-03-10', '2024-03-11'],
    ['2024-11-03', '2024-11-04'],
  ] as const)('keeps all-day civil membership across %s', (start, end) => {
    const allDay = event('all-day', start, end, { allDay: true });
    expect(eventsForDay([allDay], parseDate(start))).toEqual([allDay]);
    expect(eventsForDay([allDay], parseDate(end))).toEqual([]);
    expect(layoutEvents([allDay], parseDate(start))).toEqual([]);
  });
});
