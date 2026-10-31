import type { ApiErrorCode } from '@/types/api';

/**
 * Base class for all errors we deliberately throw in the app.
 * Route handlers translate these into the standard envelope.
 * Unknown errors are treated as INTERNAL and never leak details.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    httpStatus: number,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('BAD_REQUEST', message, 400, context);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFLICT', message, 409, context);
  }
}
