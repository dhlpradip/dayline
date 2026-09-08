import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { apiErrorSchema } from '@dayline/contracts';
import type { Logger } from 'pino';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  const requestId = String(res.getHeader('x-request-id') ?? randomUUID());
  res.setHeader('x-request-id', requestId);
  res.status(status).json(apiErrorSchema.parse({ error: { code, message, requestId } }));
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found'));
};

export function errorBoundary(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (res.headersSent) {
      // Express's default handler can print raw errors; close without forwarding secrets.
      logger.error(
        { event: 'response_aborted', requestId: res.getHeader('x-request-id') },
        'Response aborted after headers were sent',
      );
      res.destroy();
      return;
    }

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    if (error instanceof HttpError) {
      ({ status, code, message } = error);
    } else if (typeof error === 'object' && error !== null && 'type' in error) {
      if (error.type === 'entity.parse.failed') {
        status = 400;
        code = 'INVALID_JSON';
        message = 'Invalid JSON body';
      } else if (error.type === 'entity.too.large') {
        status = 413;
        code = 'PAYLOAD_TOO_LARGE';
        message = 'Request body too large';
      } else if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
        status = 415;
        code = 'UNSUPPORTED_MEDIA_TYPE';
        message = 'Unsupported request encoding';
      }
    }

    // Driver errors, parser errors, and their stacks can embed SQL, bodies, or secrets.
    logger[status >= 500 ? 'error' : 'warn'](
      {
        event: 'request_error',
        requestId: res.getHeader('x-request-id'),
        status,
        code,
      },
      'Request failed',
    );
    sendError(res, status, code, message);
  };
}
