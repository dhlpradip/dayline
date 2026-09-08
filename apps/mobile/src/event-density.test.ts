import { describe, expect, it } from 'vitest';
import {
  dateKey,
  datesInRange,
  eventsForDay,
  parseDate,
  type CalendarEvent,
} from '@dayline/domain';
import { eventDensity } from './event-density';

const event = (id: string, start: string, end: string, allDay = false): CalendarEvent => ({
  id,
  externalId: id,
  providerId: 'dayline-local',
  calendarId: 'dayline-local:default',
  title: id,
  start,
  end,
  allDay,
  description: null,
  timezone: null,
  location: null,
  url: null,
  recurring: false,
  originalStart: null,
  status: null,
});
describe('year density', () => {
  it('matches domain membership, clips long events and respects exclusive ends', () => {
    const range = { start: parseDate('2026-09-01'), end: parseDate('2026-10-01') };
    const events = [
      event('all-day', '2026-09-08', '2026-09-10', true),
      event('overnight', '2026-09-09T23:00:00', '2026-09-10T01:00:00'),
      event('long', '2020-01-01', '2030-01-01', true),
      event('outside', '2026-10-01', '2026-10-02', true),
      event('invalid', 'not-a-date', '2026-09-10'),
    ];
    const counts = eventDensity(events, range);
    for (const day of datesInRange(range))
      expect(counts.get(dateKey(day)) ?? 0).toBe(eventsForDay(events, day).length);
    expect(counts.size).toBe(30);
    expect(counts.get('2026-09-09')).toBe(3);
    expect(counts.get('2026-09-10')).toBe(2);
  });
});
