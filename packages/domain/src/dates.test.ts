import { describe, expect, it } from 'vitest';
import {
  dateKey,
  dateKeyInTimeZone,
  datesInRange,
  monthRange,
  parseDate,
  visibleRange,
} from './index';
import type { DateRange } from './index';

function keys(range: DateRange): string[] {
  return [dateKey(range.start), dateKey(range.end)];
}

describe('date parsing and keys', () => {
  it('runs in a DST-observing local timezone', () => {
    expect(new Date(2024, 0, 1).getTimezoneOffset()).toBe(300);
    expect(new Date(2024, 6, 1).getTimezoneOffset()).toBe(240);
  });

  it('parses civil dates at local midnight, not UTC midnight', () => {
    const date = parseDate('2024-02-29');
    expect(dateKey(date)).toBe('2024-02-29');
    expect(date.getHours()).toBe(0);
    expect(date.toISOString()).toBe('2024-02-29T05:00:00.000Z');
    expect(dateKey(parseDate('0099-01-02'))).toBe('0099-01-02');
  });

  it('preserves ISO instants and formats their local date', () => {
    const date = parseDate('2024-01-01T01:30:00Z');
    expect(date.toISOString()).toBe('2024-01-01T01:30:00.000Z');
    expect(dateKey(date)).toBe('2023-12-31');
    expect(+parseDate('2023-12-31T20:30:00-05:00')).toBe(+date);
  });

  it('provides explicit timezone keys without mutating the instant', () => {
    const date = parseDate('2024-01-01T01:30:00Z');
    const before = +date;
    expect(dateKeyInTimeZone(date, 'America/Los_Angeles')).toBe('2023-12-31');
    expect(dateKeyInTimeZone(date, 'Asia/Kathmandu')).toBe('2024-01-01');
    expect(+date).toBe(before);
    expect(() => dateKeyInTimeZone(date, 'Not/AZone')).toThrow(RangeError);
  });

  it.each(['', 'not-a-date', '2023-02-29', '2024-02-30', '2024-13-01'])(
    'rejects invalid ISO input %j',
    (value) => {
      expect(() => parseDate(value)).toThrow(RangeError);
    },
  );
});

describe('visible calendar ranges', () => {
  it('includes leap day and Monday-aligned padding in the month grid', () => {
    const range = monthRange(parseDate('2024-02-17'));
    expect(keys(range)).toEqual(['2024-01-29', '2024-03-04']);
    expect(datesInRange(range)).toHaveLength(35);
    expect(datesInRange(range).map(dateKey)).toContain('2024-02-29');
    expect(range.start.getDay()).toBe(1);
    expect(range.end.getDay()).toBe(1);
    expect(visibleRange(parseDate('2024-02-17'), 'month')).toEqual(range);
  });

  it.each([
    ['2021-02-15', '2021-02-01', '2021-03-01', 28],
    ['2024-09-15', '2024-08-26', '2024-10-07', 42],
    ['2024-12-15', '2024-11-25', '2025-01-06', 42],
  ] as const)('uses only the complete weeks required by %s', (date, start, end, count) => {
    const range = monthRange(parseDate(date));
    expect(keys(range)).toEqual([start, end]);
    expect(datesInRange(range)).toHaveLength(count);
  });

  it('starts a week at the selected day instead of aligning to Monday', () => {
    const selected = parseDate('2024-02-28T15:30:00');
    expect(keys(visibleRange(selected, 'week'))).toEqual(['2024-02-28', '2024-03-06']);
    expect(keys(visibleRange(selected, 'week', 3))).toEqual(['2024-02-28', '2024-03-02']);
    expect(keys(visibleRange(selected, 'day', 3))).toEqual(['2024-02-28', '2024-02-29']);
    expect(selected.getHours()).toBe(15);
  });

  it('defaults agenda to 30 calendar days and allows a custom length', () => {
    expect(keys(visibleRange(parseDate('2024-02-01'), 'agenda'))).toEqual([
      '2024-02-01',
      '2024-03-02',
    ]);
    expect(keys(visibleRange(parseDate('2024-02-01'), 'agenda', 2))).toEqual([
      '2024-02-01',
      '2024-02-03',
    ]);
  });

  it('returns Jan 1 to the following Jan 1, including leap years', () => {
    const range = visibleRange(parseDate('2024-06-15'), 'year');
    expect(keys(range)).toEqual(['2024-01-01', '2025-01-01']);
    expect(datesInRange(range)).toHaveLength(366);
    expect(datesInRange(visibleRange(parseDate('2023-06-15'), 'year'))).toHaveLength(365);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    'rejects unusable day counts %s',
    (days) => {
      expect(() => visibleRange(parseDate('2024-01-01'), 'week', days)).toThrow(RangeError);
    },
  );
});

describe('range iteration and DST', () => {
  it.each([
    ['2024-03-09', ['2024-03-09', '2024-03-10', '2024-03-11'], 71],
    ['2024-11-02', ['2024-11-02', '2024-11-03', '2024-11-04'], 73],
  ] as const)('iterates local calendar days across %s', (date, expected, hours) => {
    const range = visibleRange(parseDate(date), 'week', 3);
    const dates = datesInRange(range);
    expect(dates.map(dateKey)).toEqual(expected);
    expect(dates.every((day) => day.getHours() === 0)).toBe(true);
    expect((+range.end - +range.start) / 3_600_000).toBe(hours);
    expect(dates[0]).not.toBe(range.start);
  });

  it.each([
    ['2024-03-10', 23],
    ['2024-11-03', 25],
  ] as const)('uses the actual midnight boundaries for %s', (date, hours) => {
    const range = visibleRange(parseDate(date), 'day');
    expect((+range.end - +range.start) / 3_600_000).toBe(hours);
    expect(datesInRange(range).map(dateKey)).toEqual([date]);
  });

  it('excludes an end at midnight and includes a partially intersected day', () => {
    const start = parseDate('2024-01-01T12:00:00');
    expect(datesInRange({ start, end: parseDate('2024-01-03') }).map(dateKey)).toEqual([
      '2024-01-01',
      '2024-01-02',
    ]);
    expect(datesInRange({ start, end: parseDate('2024-01-03T00:00:01') }).map(dateKey)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
    ]);
    expect(datesInRange({ start, end: new Date(start) })).toEqual([]);
    expect(start.getHours()).toBe(12);
  });

  it('rejects reversed ranges and invalid Date objects', () => {
    const valid = parseDate('2024-01-01');
    const invalid = new Date(NaN);
    expect(() => datesInRange({ start: valid, end: parseDate('2023-01-01') })).toThrow(RangeError);
    expect(() => datesInRange({ start: valid, end: invalid })).toThrow(RangeError);
    expect(() => datesInRange({ start: invalid, end: valid })).toThrow(RangeError);
    expect(() => dateKey(invalid)).toThrow(RangeError);
    expect(() => monthRange(invalid)).toThrow(RangeError);
    expect(() => visibleRange(invalid, 'day')).toThrow(RangeError);
  });
});
