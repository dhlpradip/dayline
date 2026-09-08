import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { Logger } from 'pino';
import { PrismaClient } from './generated/prisma/client.js';
import type { Env } from './env.js';

export function createDatabase(env: Env, logger: Logger) {
  const url = new URL(env.DATABASE_URL);
  const schema = url.searchParams.get('schema') ?? 'public';
  url.searchParams.delete('schema');

  const pool = new Pool({
    connectionString: url.toString(),
    max: env.DB_POOL_MAX,
    connectionTimeoutMillis: env.DB_TIMEOUT_MS,
    query_timeout: env.DB_TIMEOUT_MS,
    statement_timeout: env.DB_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
    application_name: 'dayline-api',
  });
  pool.on('error', () => {
    logger.error({ event: 'database_pool_error' }, 'Database pool error');
  });

  // The externally supplied pool is owned here and explicitly closed after Prisma.
  const adapter = new PrismaPg(pool, { schema, disposeExternalPool: false });
  const prisma = new PrismaClient({ adapter, log: [] });

  return {
    async probe(): Promise<void> {
      await prisma.$queryRaw`SELECT 1`;
    },
    async close(): Promise<void> {
      try {
        await prisma.$disconnect();
      } finally {
        await pool.end();
      }
    },
  };
}
