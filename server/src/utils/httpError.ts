/**
 * httpError.ts
 * Standardized JSON error responses for the auth & admin user routes:
 *   { error: { message, code, details? } }
 *
 * Existing incident routes keep their own legacy shape; these helpers are used
 * by the newer auth/users routes which the dashboard auth client expects.
 */

import type { Response } from 'express';
import { ZodError } from 'zod';

export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiErrorBody = { error: { message, code } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

/** Convert a Zod parse failure into a 400 structured error. */
export function sendZodError(res: Response, err: ZodError): void {
  const first = err.issues[0];
  const field = first?.path.join('.') ?? 'field';
  sendError(
    res,
    400,
    'VALIDATION_ERROR',
    `${field}: ${first?.message ?? 'invalid value'}`,
    err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}
