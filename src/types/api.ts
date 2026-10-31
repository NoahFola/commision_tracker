/**
 * Standard API response envelope.
 * Every route returns exactly one of these two shapes.
 * See README §Conventions.
 */
export type ApiSuccess<T> = { ok: true; data: T };

export type ApiErrorCode =
  'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL';

export type ApiFailure = {
  ok: false;
  error: { code: ApiErrorCode; message: string };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Standard paginated payload used by every list endpoint.
 * `totalPages` is Math.ceil(total / limit) and is 0 when total is 0.
 */
export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
