import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env.js';

const valid = {
  DATABASE_URL: 'postgresql://dayline:secret@localhost:5432/dayline?schema=public',
  CORS_ORIGINS: 'http://localhost:8081',
};

describe('API environment', () => {
  it('parses required values and safe defaults', () => {
    expect(parseEnv(valid)).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 3001,
      NODE_ENV: 'development',
      CORS_ORIGINS: ['http://localhost:8081'],
      DB_TIMEOUT_MS: 2000,
    });
  });

  it('parses numeric overrides and trims/deduplicates origins', () => {
    expect(
      parseEnv({
        ...valid,
        PORT: '4000',
        RATE_LIMIT_MAX: '20',
        CORS_ORIGINS: 'https://example.com, http://localhost:8081,https://example.com',
      }),
    ).toMatchObject({
      PORT: 4000,
      RATE_LIMIT_MAX: 20,
      CORS_ORIGINS: ['https://example.com', 'http://localhost:8081'],
    });
  });

  it.each([
    ['PORT', ''],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '1.5'],
    ['PORT', 'abc'],
    ['HOST', ' '],
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['RATE_LIMIT_MAX', '0'],
    ['RATE_LIMIT_WINDOW_MS', '999'],
    ['DB_POOL_MAX', '51'],
    ['DB_TIMEOUT_MS', '0'],
    ['SHUTDOWN_TIMEOUT_MS', '-1'],
    ['DATABASE_URL', 'mysql://user:pass@localhost/db'],
    ['DATABASE_URL', 'not-a-url'],
    ['DATABASE_URL', 'postgresql://localhost'],
    ['DATABASE_URL', 'postgresql://localhost/db#secret'],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'https://*.example.com'],
    ['CORS_ORIGINS', 'null'],
    ['CORS_ORIGINS', ''],
    ['CORS_ORIGINS', 'https://example.com/'],
    ['CORS_ORIGINS', 'https://example.com/path'],
    ['CORS_ORIGINS', 'https://user:pass@example.com'],
    ['CORS_ORIGINS', 'ftp://example.com'],
    ['CORS_ORIGINS', 'https://example.com,'],
  ])('rejects invalid %s = %s', (key, value) => {
    expect(() => parseEnv({ ...valid, [key]: value })).toThrow(`Invalid API environment: ${key}`);
  });

  it('requires explicit database URL and CORS origins', () => {
    expect(() => parseEnv({})).toThrow('Invalid API environment: DATABASE_URL, CORS_ORIGINS');
  });

  it('never includes supplied secrets in validation errors', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'secret-password' })).toThrow(
      'Invalid API environment: DATABASE_URL',
    );
    try {
      parseEnv({ ...valid, DATABASE_URL: 'secret-password' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-password');
    }
  });
});
