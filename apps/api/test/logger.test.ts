import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/env.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { lines, logger: createLogger('info', stream) };
}

describe('structured logging', () => {
  it('redacts sensitive fields as defense in depth', () => {
    const { lines, logger } = capture();
    logger.info(
      {
        password: 'secret-password',
        DATABASE_URL: 'postgresql://secret-url',
        req: { headers: { authorization: 'Bearer secret-token', cookie: 'session=secret-cookie' } },
        res: { headers: { 'set-cookie': 'session=secret-response' } },
        account: { tokenHash: 'secret-hash' },
      },
      'Test',
    );
    expect(lines.join('')).not.toContain('secret-');
    expect(JSON.parse(lines[0] ?? '').password).toBe('[REDACTED]');
  });

  it('logs correlation and status without URLs, bodies, headers, or raw driver errors', async () => {
    const { lines, logger } = capture();
    const env = parseEnv({
      DATABASE_URL: 'postgresql://unused@localhost/test',
      CORS_ORIGINS: 'http://localhost:8081',
    });
    const app = createApp({
      env,
      logger,
      probeDatabase: async () => {
        throw new Error('secret-database');
      },
    });
    const response = await request(app)
      .get('/ready?token=secret-query')
      .set('Authorization', 'Bearer secret-auth')
      .set('Cookie', 'session=secret-cookie');
    expect(lines.join('')).not.toContain('secret-');
    const completion = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line['event'] === 'request_completed');
    expect(completion).toMatchObject({
      requestId: response.headers['x-request-id'],
      status: 503,
      method: 'GET',
      service: 'dayline-api',
    });
  });
});
