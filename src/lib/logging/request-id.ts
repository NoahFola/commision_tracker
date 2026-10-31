import { headers } from 'next/headers';

/**
 * Reads the current request's ID. Prefers the value injected by
 * middleware (which runs first); returns undefined if missing.
 *
 * Two forms, because the caller's context differs:
 *   - `requestIdFromRequest(request)`: route handlers.
 *   - `requestIdFromHeaders()`: server components.
 */
export function requestIdFromRequest(request: Request): string | undefined {
  return request.headers.get('x-request-id') ?? undefined;
}

export async function requestIdFromHeaders(): Promise<string | undefined> {
  const h = await headers();
  return h.get('x-request-id') ?? undefined;
}
