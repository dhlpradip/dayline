import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createDatabase } from './database.js';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const database = createDatabase(env, logger);
  let shuttingDown = false;
  const app = createApp({
    env,
    logger,
    probeDatabase: database.probe,
    isShuttingDown: () => shuttingDown,
  });
  const server = createServer(app);
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.timeout = 30_000;

  const shutdown = async (exitCode: number): Promise<void> => {
    process.exitCode = Math.max(Number(process.exitCode ?? 0), exitCode);
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ event: 'shutdown_started' }, 'Shutting down');
    const deadline = setTimeout(() => {
      logger.error({ event: 'shutdown_timeout' }, 'Shutdown deadline exceeded');
      server.closeAllConnections();
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    deadline.unref();

    try {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await database.close();
      logger.info({ event: 'shutdown_completed' }, 'Shutdown complete');
    } catch {
      logger.error({ event: 'shutdown_failed' }, 'Shutdown failed');
      server.closeAllConnections();
      process.exit(1);
    } finally {
      clearTimeout(deadline);
    }
  };

  process.once('SIGINT', () => {
    void shutdown(0);
  });
  process.once('SIGTERM', () => {
    void shutdown(0);
  });
  process.once('uncaughtException', () => {
    logger.fatal({ event: 'uncaught_exception' }, 'Fatal runtime error');
    void shutdown(1);
  });
  process.once('unhandledRejection', () => {
    logger.fatal({ event: 'unhandled_rejection' }, 'Fatal runtime error');
    void shutdown(1);
  });
  server.on('error', () => {
    logger.error({ event: 'server_error' }, 'HTTP server error');
    void shutdown(1);
  });
  server.listen(env.PORT, env.HOST, () => {
    logger.info({ event: 'server_started', host: env.HOST, port: env.PORT }, 'API listening');
  });
}

void main().catch(() => {
  // Startup exceptions can contain secrets; env validation itself is testable via parseEnv.
  createLogger('error').fatal(
    { event: 'startup_failed' },
    'API startup failed; check environment configuration and generated Prisma client',
  );
  process.exitCode = 1;
});
