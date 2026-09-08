import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { healthResponseSchema, readinessResponseSchema } from '@dayline/contracts';
import type { Logger } from 'pino';
import type { Env } from './env.js';
import { errorBoundary, HttpError, notFound, sendError } from './errors.js';

export interface AppDependencies {
  env: Env;
  logger: Logger;
  probeDatabase: () => Promise<void>;
  isShuttingDown?: () => boolean;
}

export function createApp({
  env,
  logger,
  probeDatabase,
  isShuttingDown = () => false,
}: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  // Never trust user-supplied forwarding headers for IP-based limits.
  app.set('trust proxy', false);
  app.set('json escape', true);

  app.use((req, res, next) => {
    const requestId = randomUUID();
    const started = performance.now();
    res.setHeader('x-request-id', requestId);
    res.setHeader('cache-control', 'no-store');
    let logged = false;
    const logCompletion = () => {
      if (logged) return;
      logged = true;
      // Deliberately omit URLs, query strings, headers, bodies, and IPs.
      logger.info(
        {
          event: 'request_completed',
          requestId,
          method: req.method,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - started),
          aborted: !res.writableFinished,
        },
        'Request completed',
      );
    };
    res.once('finish', logCompletion);
    res.once('close', logCompletion);
    next();
  });
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => sendError(res, 429, 'RATE_LIMITED', 'Too many requests'),
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (origin === undefined || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed'));
        }
      },
      credentials: false,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '16kb', strict: true, inflate: false }));

  app.get('/health', (_req, res) => {
    res.json(healthResponseSchema.parse({ status: 'ok', service: 'dayline-api' }));
  });

  // Share the probe across concurrent requests, without caching the result.
  let pendingProbe: Promise<void> | undefined;
  const probe = () => {
    if (!pendingProbe) {
      pendingProbe = Promise.resolve().then(probeDatabase);
      void pendingProbe.then(
        () => {
          pendingProbe = undefined;
        },
        () => {
          pendingProbe = undefined;
        },
      );
    }
    return pendingProbe;
  };

  app.get('/ready', async (_req, res) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (isShuttingDown()) throw new Error('Shutting down');
      await Promise.race([
        probe(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), env.DB_TIMEOUT_MS);
        }),
      ]);
      if (isShuttingDown()) throw new Error('Shutting down');
      res.json(readinessResponseSchema.parse({ status: 'ready', database: 'up' }));
    } catch {
      logger.warn(
        { event: 'readiness_unavailable', requestId: res.getHeader('x-request-id') },
        'Readiness unavailable',
      );
      res
        .status(503)
        .json(readinessResponseSchema.parse({ status: 'unavailable', database: 'down' }));
    } finally {
      if (timer) clearTimeout(timer);
    }
  });

  app.use(notFound);
  app.use(errorBoundary(logger));
  return app;
}
