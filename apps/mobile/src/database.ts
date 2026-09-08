import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { Calendar, CalendarEvent, CalendarProvider, DateRange } from '@dayline/domain';
import { parseDate } from '@dayline/domain';
import { migrate } from './migrations';
import { decodePreferences, preferenceSnapshot, usePreferences } from './preferences';

let database: SQLiteDatabase | undefined;
let bootstrapPromise: Promise<void> | undefined;
let writes = Promise.resolve();

export function bootstrap(): Promise<void> {
  bootstrapPromise ??= (async () => {
    const db = await openDatabaseAsync('dayline.db');
    try {
      // Expo's transaction handle deliberately omits transaction nesting.
      await migrate({
        execAsync: (sql) => db.execAsync(sql),
        getFirstAsync: <T>(sql: string) => db.getFirstAsync<T>(sql),
        withExclusiveTransactionAsync: (task) =>
          db.withExclusiveTransactionAsync(async (tx) => {
            await task({
              execAsync: (sql) => tx.execAsync(sql),
              getFirstAsync: <T>(sql: string) => tx.getFirstAsync<T>(sql),
              withExclusiveTransactionAsync: async () => {
                throw new Error('Nested migrations are not supported.');
              },
            });
          }),
      });
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM preferences WHERE key = ?',
        'ui',
      );
      database = db;
      usePreferences.getState().hydrate(decodePreferences(row?.value));
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
  })().catch((error: unknown) => {
    bootstrapPromise = undefined;
    throw error;
  });
  return bootstrapPromise;
}

function db(): SQLiteDatabase {
  if (!database) throw new Error('Local storage is not ready.');
  return database;
}

export function persistPreferences(): Promise<void> {
  const value = JSON.stringify(preferenceSnapshot());
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      await db().runAsync(
        'INSERT INTO preferences(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        'ui',
        value,
      );
    });
  return writes.then(
    () => usePreferences.getState().markSaveError(false),
    () => usePreferences.getState().markSaveError(true),
  );
}

export const localProvider: CalendarProvider = {
  id: 'dayline-local',
  capabilities: () => ({
    read: true,
    create: false,
    update: false,
    delete: false,
    recurrence: false,
  }),
  async getCalendars(): Promise<Calendar[]> {
    const rows = await db().getAllAsync<{ id: string; title: string; color: string }>(
      'SELECT * FROM local_calendars ORDER BY title',
    );
    return rows.map((row) => ({
      ...row,
      id: `dayline-local:${row.id}`,
      externalId: row.id,
      providerId: 'dayline-local',
      source: 'This device',
      readOnly: true,
      allowsModifications: false,
    }));
  },
  async getEvents(range: DateRange, calendarIds: string[]): Promise<CalendarEvent[]> {
    const ids = calendarIds
      .filter((id) => id.startsWith('dayline-local:'))
      .map((id) => id.slice('dayline-local:'.length));
    if (!ids.length) return [];
    // Payloads may contain civil all-day dates: compare after local parsing, not SQL text ordering.
    const rows = await db().getAllAsync<{ payload: string }>(
      `SELECT payload FROM local_events WHERE calendar_id IN (${ids.map(() => '?').join(',')})`,
      ...ids,
    );
    return rows
      .map((row) => JSON.parse(row.payload) as CalendarEvent)
      .filter((event) => parseDate(event.start) < range.end && parseDate(event.end) > range.start);
  },
  async getEvent(id: string): Promise<CalendarEvent | null> {
    const row = await db().getFirstAsync<{ payload: string }>(
      'SELECT payload FROM local_events WHERE id = ?',
      id,
    );
    return row ? (JSON.parse(row.payload) as CalendarEvent) : null;
  },
};
