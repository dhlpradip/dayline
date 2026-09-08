import { pino, type DestinationStream, type Logger } from 'pino';
import type { Env } from './env.js';

export function createLogger(level: Env['LOG_LEVEL'], destination?: DestinationStream): Logger {
  const options = {
    level,
    base: { service: 'dayline-api' },
    redact: {
      paths: [
        'authorization',
        'cookie',
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'tokenHash',
        'DATABASE_URL',
        'databaseUrl',
        'connectionString',
        '*.authorization',
        '*.cookie',
        '*.password',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.tokenHash',
        '*.DATABASE_URL',
        '*.databaseUrl',
        '*.connectionString',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
  };
  return destination ? pino(options, destination) : pino(options);
}
