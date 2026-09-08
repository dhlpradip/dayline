import {
  dateKey,
  datesInRange,
  parseDate,
  type CalendarEvent,
  type DateRange,
} from '@dayline/domain';

/** Parse each event once rather than rescanning a year's events for every mini-calendar cell. */
export function eventDensity(events: CalendarEvent[], range: DateRange): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    try {
      const start = parseDate(event.start);
      const end = parseDate(event.end);
      if (start >= end || start >= range.end || end <= range.start) continue;
      const clipped = {
        start: start < range.start ? range.start : start,
        end: end > range.end ? range.end : end,
      };
      for (const day of datesInRange(clipped)) {
        const key = dateKey(day);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    } catch {
      /* Ignore malformed records consistently with domain eventsForDay. */
    }
  }
  return counts;
}
