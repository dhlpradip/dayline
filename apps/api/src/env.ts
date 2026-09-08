import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const databaseUrl = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['postgresql:', 'postgres:'].includes(url.protocol) &&
        url.hostname.length > 0 &&
        url.pathname.length > 1 &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, 'Must be a PostgreSQL connection URL');

const origins = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((item) => item.trim()))
  .pipe(
    z
      .array(
        z.string().refine((value) => {
          try {
            const url = new URL(value);
            return (
              ['http:', 'https:'].includes(url.protocol) &&
              !url.hostname.includes('*') &&
              url.origin === value
            );
          } catch {
            return false;
          }
        }, 'Must be an exact HTTP(S) origin without a path or wildcard'),
      )
      .min(1),
  )
  .transform((value) => [...new Set(value)]);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: databaseUrl,
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: integer(3001, 1, 65535),
  CORS_ORIGINS: origins,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_WINDOW_MS: integer(60_000, 1_000, 3_600_000),
  RATE_LIMIT_MAX: integer(120, 1, 100_000),
  DB_POOL_MAX: integer(5, 1, 50),
  DB_TIMEOUT_MS: integer(2_000, 100, 30_000),
  SHUTDOWN_TIMEOUT_MS: integer(10_000, 1_000, 60_000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Never print Zod issues or received values: connection strings contain credentials.
    const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid API environment: ${keys.join(', ')}`);
  }
  return result.data;
}

export function loadEnv(): Env {
  // src/ and dist/ have identical depth, so this is independent of process.cwd().
  config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
  return parseEnv(process.env);
}
