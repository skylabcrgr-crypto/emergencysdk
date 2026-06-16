/**
 * requestLogger.ts
 * Attaches a UUID request ID to every inbound request and emits
 * a single structured JSON log line per response to stdout.
 *
 * Log fields:
 *   ts        — ISO-8601 timestamp
 *   requestId — UUID v4 for correlation across services
 *   method    — HTTP method
 *   path      — request path (no query string — avoids PII in logs)
 *   status    — HTTP response status code
 *   ms        — total response time in milliseconds
 *   ip        — client IP (respects X-Forwarded-For from Vercel/Railway)
 *   ua        — first 120 chars of User-Agent
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  const startMs   = Date.now();

  // Expose request ID downstream (services, error handler)
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const log: Record<string, unknown> = {
      ts:        new Date().toISOString(),
      requestId,
      method:    req.method,
      path:      req.path,
      status:    res.statusCode,
      ms:        Date.now() - startMs,
      ip:        getClientIp(req),
      ua:        (req.headers['user-agent'] ?? '').slice(0, 120) || null,
    };
    // Single-line JSON log — pipe-friendly for Railway / Cloud Run log aggregators
    process.stdout.write(JSON.stringify(log) + '\n');
  });

  next();
}

/** Extract originating IP, respecting Vercel / Railway X-Forwarded-For. */
export function getClientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip ?? null;
}
