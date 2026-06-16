/**
 * errorHandler.ts
 * Central Express error-handling middleware.
 *
 * SECURITY: Stack traces and internal details are never sent to clients
 * in staging/production (NODE_ENV !== 'development').
 * All 5xx errors are logged to stderr with full detail for ops teams.
 *
 * Usage: register LAST in app.ts — after all routes.
 *   app.use(errorHandler);
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface HttpError extends Error {
  statusCode?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode ?? 500;
  const requestId  = req.headers['x-request-id'] ?? 'unknown';
  const isDev      = env.NODE_ENV === 'development';

  if (statusCode >= 500) {
    process.stderr.write(
      JSON.stringify({
        ts:        new Date().toISOString(),
        level:     'error',
        requestId,
        method:    req.method,
        path:      req.path,
        status:    statusCode,
        message:   err.message,
        stack:     err.stack,
      }) + '\n'
    );
  }

  const clientMessage =
    statusCode >= 500 && !isDev
      ? 'Internal server error'
      : err.message;

  const body: Record<string, unknown> = {
    success:   false,
    error:     clientMessage,
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Include stack only in local development
  if (isDev && statusCode >= 500 && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
