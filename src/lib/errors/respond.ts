import { NextResponse } from 'next/server';
import { AppError } from './app-error';
import { logger } from '@/lib/logging';
import type { ApiFailure, ApiSuccess } from '@/types/api';

/** Success envelope. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

/** Failure envelope. */
export function fail(
  code: ApiFailure['error']['code'],
  message: string,
  httpStatus: number,
): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false, error: { code, message } }, { status: httpStatus });
}

/**
 * Wraps a route handler so thrown AppErrors become envelopes and
 * unexpected errors become a generic INTERNAL envelope (logged, not leaked).
 *
 * `requestId` is optional. When present, it is included in the log line
 * so a specific request can be correlated with its error.
 */
export function toErrorResponse(err: unknown, requestId?: string): NextResponse<ApiFailure> {
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.httpStatus);
  }
  logger.error('unhandled error in route handler', { requestId, err });
  return fail('INTERNAL', 'Something went wrong', 500);
}
