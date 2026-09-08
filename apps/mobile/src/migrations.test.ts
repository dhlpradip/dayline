import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, migrations, type MigrationDatabase } from './migrations';

const opened: DatabaseSync[] = [];
function fixture(failVersionWrite = false) {
  const sqlite = new DatabaseSync(':memory:');
  opened.push(sqlite);
  const adapter: MigrationDatabase = {
    async execAsync(sql) {
      if (failVersionWrite && sql.startsWith('PRAGMA user_version ='))
        throw new Error('Simulated storage failure');
      sqlite.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return (sqlite.prepare(sql).get() as T | undefined) ?? null;
    },
    async withExclusiveTransactionAsync(task) {
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        await task(adapter);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, adapter };
}
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});
describe('SQLite bootstrap migrations (real SQLite, no Expo native boot)', () => {
  it('creates only the default local calendar, no demo events', async () => {
    const { sqlite, adapter } = fixture();
    await migrate(adapter);
    expect(sqlite.prepare('PRAGMA user_version').get()).toMatchObject({
      user_version: migrations.length,
    });
    expect(sqlite.prepare('SELECT * FROM local_calendars').all()).toEqual([
      { id: 'default', title: 'On this device', color: '#5265D9' },
    ]);
    expect(sqlite.prepare('SELECT * FROM local_events').all()).toEqual([]);
    expect(sqlite.prepare('PRAGMA foreign_keys').get()).toMatchObject({ foreign_keys: 1 });
  });
  it('is repeatable and preserves preferences', async () => {
    const { sqlite, adapter } = fixture();
    await migrate(adapter);
    sqlite
      .prepare('INSERT INTO preferences(key, value) VALUES (?, ?)')
      .run('ui', '{"view":"year"}');
    await migrate(adapter);
    expect(sqlite.prepare('SELECT value FROM preferences WHERE key = ?').get('ui')).toMatchObject({
      value: '{"view":"year"}',
    });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM local_calendars').get()).toMatchObject({
      count: 1,
    });
  });
  it('rolls schema and version back together after failure', async () => {
    const { sqlite, adapter } = fixture(true);
    await expect(migrate(adapter)).rejects.toThrow('Simulated storage failure');
    expect(sqlite.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 0 });
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'local_calendars'").get(),
    ).toBeUndefined();
  });
  it('rejects a newer schema without destructive recovery', async () => {
    const { sqlite, adapter } = fixture();
    sqlite.exec('PRAGMA user_version = 99');
    await expect(migrate(adapter)).rejects.toThrow('newer version');
    expect(sqlite.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 99 });
  });
});
