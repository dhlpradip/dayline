export interface MigrationDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withExclusiveTransactionAsync(
    task: (transaction: MigrationDatabase) => Promise<void>,
  ): Promise<void>;
}

export const migrations = [
  `CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS local_calendars (
     id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, color TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS local_events (
     id TEXT PRIMARY KEY NOT NULL,
     calendar_id TEXT NOT NULL REFERENCES local_calendars(id),
     start TEXT NOT NULL, end TEXT NOT NULL, payload TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS local_events_range ON local_events(calendar_id, start, end);
   INSERT OR IGNORE INTO local_calendars(id, title, color) VALUES ('default', 'On this device', '#5265D9');`,
] as const;

/** Version and schema advance atomically. A failed migration leaves the previous version intact. */
export async function migrate(db: MigrationDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await db.withExclusiveTransactionAsync(async (tx) => {
    const version =
      (await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    if (version > migrations.length)
      throw new Error('This database needs a newer version of Dayline.');
    for (let index = version; index < migrations.length; index += 1) {
      await tx.execAsync(migrations[index]!);
      await tx.execAsync(`PRAGMA user_version = ${index + 1}`);
    }
  });
}
