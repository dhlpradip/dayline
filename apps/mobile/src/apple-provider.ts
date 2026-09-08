import { Platform } from 'react-native';
import type { CalendarProvider, CalendarEvent } from '@dayline/domain';
import { mapCalendar, mapEvent, occurrenceRange } from './native-mapping';

export type Access = 'checking' | 'granted' | 'undetermined' | 'denied' | 'unavailable' | 'error';
export class CalendarAccessError extends Error {
  constructor() {
    super('Calendar access is no longer available.');
  }
}

/** This is the only module allowed to call the native calendar API. No legacy API imports. */
export class AppleCalendarProvider implements CalendarProvider {
  readonly id = 'apple-system' as const;
  private generation = 0;
  private native: Promise<typeof import('expo-calendar')> | undefined;
  capabilities() {
    return { read: true, create: false, update: false, delete: false, recurrence: true };
  }
  private api() {
    this.native ??= import('expo-calendar');
    return this.native;
  }
  invalidate() {
    this.generation += 1;
  }

  async access(request = false): Promise<Access> {
    if (Platform.OS !== 'ios') return 'unavailable';
    let api: typeof import('expo-calendar');
    try {
      api = await this.api();
    } catch {
      return 'unavailable';
    }
    try {
      const result = request
        ? await api.requestCalendarPermissions(false)
        : await api.getCalendarPermissions(false);
      return result.granted
        ? 'granted'
        : result.status === 'undetermined'
          ? 'undetermined'
          : 'denied';
    } catch {
      return 'error';
    }
  }

  private async read<T>(work: (api: typeof import('expo-calendar')) => Promise<T>): Promise<T> {
    const generation = this.generation;
    if ((await this.access()) !== 'granted' || generation !== this.generation)
      throw new CalendarAccessError();
    let result: T;
    try {
      result = await work(await this.api());
    } catch (error) {
      if (generation !== this.generation || (await this.access()) !== 'granted')
        throw new CalendarAccessError();
      throw error;
    }
    if (generation !== this.generation) throw new CalendarAccessError();
    if ((await this.access()) !== 'granted' || generation !== this.generation)
      throw new CalendarAccessError();
    return result;
  }
  async getCalendars() {
    return this.read(async (api) =>
      (await api.getCalendars(api.EntityTypes.EVENT)).map(mapCalendar),
    );
  }
  async getEvents(range: { start: Date; end: Date }, calendarIds: string[]) {
    const ids = calendarIds
      .filter((id) => id.startsWith('apple-system:'))
      .map((id) => id.slice('apple-system:'.length));
    if (!ids.length) return [];
    return this.read(async (api) => {
      const events = (await api.listEvents(ids, range.start, range.end)).map(mapEvent);
      return [...new Map(events.map((event) => [event.id, event])).values()];
    });
  }
  async getEvent(id: string): Promise<CalendarEvent | null> {
    const range = occurrenceRange(id);
    if (!range) return null;
    // Re-query the exact occurrence window. Fetching a series master by externalId would silently
    // show the wrong day for repeated events. A changed/deleted occurrence returns unavailable.
    const events = await this.getEvents(range, [`apple-system:${range.calendarId}`]);
    return events.find((event) => event.id === id) ?? null;
  }
}
