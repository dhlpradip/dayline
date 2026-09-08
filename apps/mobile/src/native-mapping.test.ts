import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapCalendar, mapEvent, occurrenceRange, type NativeEvent } from './native-mapping';

const base: NativeEvent = {
  id: 'series-id',
  calendarId: 'work',
  title: 'Actual source event',
  startDate: '2026-09-08T09:00:00-04:00',
  endDate: '2026-09-08T10:00:00-04:00',
  allDay: false,
  notes: 'Private notes',
  location: 'Office',
  timeZone: 'America/New_York',
  recurrenceRule: { frequency: 'daily' },
};
describe('SDK57 native dependency contract', () => {
  it('has the pnpm patch applied to the installed iOS event timezone getter', () => {
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve('expo-calendar/package.json');
    const source = readFileSync(
      join(dirname(packagePath), 'ios/Next/CalendarNextModule.swift'),
      'utf8',
    );
    const eventGetter = source
      .match(
        /Property\("timeZone"\)\s*\{\s*\(expoEvent: ExpoCalendarEvent\) in\s*([^\n]+)\s*\}/,
      )?.[1]
      ?.trim();
    expect(
      eventGetter,
      'Apply patches/expo-calendar@57.0.2.patch via pnpm.patchedDependencies and reinstall before building iOS.',
    ).toBe('expoEvent.event?.timeZone?.identifier');
  });
});

describe('SDK57 native normalization', () => {
  it('preserves source fields while qualifying calendar identifiers', () => {
    expect(mapEvent(base)).toMatchObject({
      providerId: 'apple-system',
      calendarId: 'apple-system:work',
      externalId: 'series-id',
      description: 'Private notes',
      location: 'Office',
      start: '2026-09-08T13:00:00.000Z',
      end: '2026-09-08T14:00:00.000Z',
      recurring: true,
    });
    expect(
      mapCalendar({
        id: 'work',
        title: 'Work',
        source: { name: 'iCloud' },
        allowsModifications: false,
      }),
    ).toMatchObject({
      id: 'apple-system:work',
      readOnly: true,
      allowsModifications: false,
      source: 'iCloud',
    });
  });
  it('does not collapse occurrences that share an EventKit series identifier', () => {
    const first = mapEvent(base);
    const second = mapEvent({
      ...base,
      startDate: '2026-09-09T09:00:00-04:00',
      endDate: '2026-09-09T10:00:00-04:00',
    });
    expect(first.id).not.toBe(second.id);
    expect(occurrenceRange(second.id)?.calendarId).toBe('work');
    expect(occurrenceRange(second.id)?.start.getTime()).toBeLessThan(
      new Date(second.start).getTime(),
    );
  });
  it('preserves exclusive all-day civil boundaries in the event timezone', () => {
    expect(
      mapEvent({
        ...base,
        allDay: true,
        timeZone: 'Pacific/Auckland',
        startDate: new Date('2026-09-07T12:00:00Z'),
        endDate: new Date('2026-09-09T12:00:00Z'),
      }),
    ).toMatchObject({ start: '2026-09-08', end: '2026-09-10', allDay: true });
    expect(
      mapEvent({ ...base, allDay: true, startDate: '2026-09-08', endDate: '2026-09-09' }),
    ).toMatchObject({ start: '2026-09-08', end: '2026-09-09' });
  });
  it('preserves New York summer all-day dates independently of the viewer timezone', () => {
    // Run this suite under TZ=Pacific/Honolulu and TZ=Asia/Tokyo. These UTC instants are
    // midnight in New York during DST, but have different civil dates for those viewers.
    const event = mapEvent({
      ...base,
      allDay: true,
      timeZone: 'America/New_York',
      startDate: '2026-09-08T04:00:00.000Z',
      endDate: '2026-09-09T04:00:00.000Z',
    });
    expect(event).toMatchObject({
      start: '2026-09-08',
      end: '2026-09-09',
      timezone: 'America/New_York',
      allDay: true,
    });
    // This is the upstream SDK57 label bug, not a safe alternative representation of the zone.
    const dayWithStandardLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: 'EST',
      day: '2-digit',
    }).formatToParts(new Date('2026-09-08T04:00:00.000Z'));
    expect(dayWithStandardLabel.find((part) => part.type === 'day')?.value).toBe('07');
  });
  it('does not silently use the viewer timezone for an invalid non-empty source identifier', () => {
    expect(() =>
      mapEvent({
        ...base,
        allDay: true,
        timeZone: 'Not/A_Timezone',
      }),
    ).toThrow(RangeError);
  });
  it('recognizes detached recurrence and normalizes optional values', () => {
    const event = mapEvent({
      ...base,
      recurrenceRule: null,
      isDetached: true,
      title: '',
      notes: '',
      originalStartDate: '2026-09-08T09:00:00-04:00',
    });
    expect(event.recurring).toBe(true);
    expect(event.title).toBe('Untitled event');
    expect(event.description).toBeNull();
    expect(event.originalStart).toBe('2026-09-08T13:00:00.000Z');
  });
  it('rejects malformed occurrence handles and invalid dates', () => {
    expect(occurrenceRange('not-a-handle')).toBeNull();
    expect(occurrenceRange('["apple-system"]')).toBeNull();
    expect(() => mapEvent({ ...base, startDate: 'invalid' })).toThrow();
  });
});
