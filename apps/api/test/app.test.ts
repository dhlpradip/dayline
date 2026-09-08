import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { apiErrorSchema, healthResponseSchema, readinessResponseSchema } from '@dayline/contracts';
import { createApp } from '../src/app.js';
import { parseEnv, type Env } from '../src/env.js';
import { errorBoundary } from '../src/errors.js';
import { createLogger } from '../src/logger.js';

const env = parseEnv({
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  CORS_ORIGINS: 'http://localhost:8081,https://calendar.example.com',
  LOG_LEVEL: 'silent',
});
const logger = createLogger('silent');

function setup(overrides: Partial<Env> = {}, probeDatabase = vi.fn(async () => {})) {
  return {
    app: createApp({ env: { ...env, ...overrides }, logger, probeDatabase }),
    probeDatabase,
  };
}

describe('API', () => {
  it('serves liveness without probing the database and sets security headers', async () => {
    const { app, probeDatabase } = setup();
    const response = await request(app).get('/health').expect(200);
    expect(healthResponseSchema.parse(response.body)).toEqual({
      status: 'ok',
      service: 'dayline-api',
    });
    expect(probeDatabase).not.toHaveBeenCalled();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('uses unique server-generated request IDs, not untrusted inbound IDs', async () => {
    const { app } = setup();
    const first = await request(app).get('/health').set('X-Request-Id', 'attacker-controlled');
    const second = await request(app).get('/health');
    expect(first.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('returns ready only after a successful probe', async () => {
    const { app, probeDatabase } = setup();
    const response = await request(app).get('/ready').expect(200);
    expect(readinessResponseSchema.parse(response.body)).toEqual({
      status: 'ready',
      database: 'up',
    });
    expect(probeDatabase).toHaveBeenCalledOnce();
  });

  it('returns a generic unavailable response for database failures', async () => {
    const { app } = setup(
      {},
      vi.fn(async () => {
        throw new Error('postgresql://secret:password@db/private SQL');
      }),
    );
    const response = await request(app).get('/ready').expect(503);
    expect(readinessResponseSchema.parse(response.body)).toEqual({
      status: 'unavailable',
      database: 'down',
    });
    expect(response.text).not.toMatch(/secret|password|SQL/);
  });

  it('bounds a hanging probe and shares it across concurrent requests', async () => {
    const { app, probeDatabase } = setup(
      { DB_TIMEOUT_MS: 100 },
      vi.fn(() => new Promise<void>(() => {})),
    );
    const responses = await Promise.all([request(app).get('/ready'), request(app).get('/ready')]);
    expect(responses.map((response) => response.status)).toEqual([503, 503]);
    expect(probeDatabase).toHaveBeenCalledOnce();
  });

  it('retries after a failed probe rather than caching its result', async () => {
    const probeDatabase = vi.fn(async () => {}).mockRejectedValueOnce(new Error('offline'));
    const { app } = setup({}, probeDatabase);
    await request(app).get('/ready').expect(503);
    await request(app).get('/ready').expect(200);
    expect(probeDatabase).toHaveBeenCalledTimes(2);
  });

  it('marks readiness unavailable during shutdown without probing', async () => {
    const probeDatabase = vi.fn(async () => {});
    const app = createApp({ env, logger, probeDatabase, isShuttingDown: () => true });
    await request(app).get('/ready').expect(503);
    await request(app).get('/health').expect(200);
    expect(probeDatabase).not.toHaveBeenCalled();
  });

  it('allows exact configured origins and preflight without credentials', async () => {
    const { app } = setup();
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:8081')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers['access-control-expose-headers']).toBe('X-Request-Id');
    const preflight = await request(app)
      .options('/health')
      .set('Origin', 'https://calendar.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('https://calendar.example.com');
  });

  it.each(['https://evil.example', 'http://localhost:8081.evil.example', 'null'])(
    'rejects disallowed origin %s with the error contract',
    async (origin) => {
      const { app } = setup();
      const response = await request(app).get('/health').set('Origin', origin).expect(403);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('ORIGIN_NOT_ALLOWED');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    },
  );

  it('returns a contract-shaped 404 without reflecting the URL', async () => {
    const { app } = setup();
    const response = await request(app).get('/missing?token=secret').expect(404);
    expect(apiErrorSchema.parse(response.body).error).toEqual({
      code: 'NOT_FOUND',
      message: 'Route not found',
      requestId: response.headers['x-request-id'],
    });
    expect(response.text).not.toContain('secret');
  });

  it('rate limits using the error contract and retry headers', async () => {
    const { app } = setup({ RATE_LIMIT_MAX: 1 });
    await request(app).get('/health').expect(200);
    const response = await request(app).get('/health').expect(429);
    expect(apiErrorSchema.parse(response.body).error.code).toBe('RATE_LIMITED');
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.headers['ratelimit']).toBeDefined();
  });

  it('rejects malformed JSON safely', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/missing')
      .set('Content-Type', 'application/json')
      .send('{"password":"secret",')
      .expect(400);
    expect(apiErrorSchema.parse(response.body).error.code).toBe('INVALID_JSON');
    expect(response.text).not.toContain('secret');
  });

  it('limits JSON request body size', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/missing')
      .send({ value: 'x'.repeat(17 * 1024) })
      .expect(413);
    expect(apiErrorSchema.parse(response.body).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('handles Express 5 async failures without leaking details', async () => {
    const app = express();
    app.get('/fail', async () => {
      throw new Error('password=secret; SELECT private');
    });
    app.use(errorBoundary(logger));
    const response = await request(app).get('/fail').expect(500);
    expect(apiErrorSchema.parse(response.body).error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: response.headers['x-request-id'],
    });
    expect(response.text).not.toMatch(/password|secret|SELECT|stack/);
  });
});
