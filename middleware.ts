import { NextResponse, type NextRequest } from 'next/server';

/**
 * Request ID middleware. Runs on every request, before route handlers.
 *
 * Behaviour:
 *   - Reads `x-request-id` from the incoming request.
 *   - Accepts it if it is a string of 1..128 printable ASCII chars.
 *   - Otherwise generates a fresh UUID v4.
 *   - Sets it on the forwarded request (as `x-request-id`) so route
 *     handlers and server components can read it.
 *   - Sets it on the response, so the client can correlate logs.
 *
 * Runs on the Edge runtime, so it must not import anything Node-only.
 * `crypto.randomUUID()` is available in both Edge and Node 20.
 */
export function middleware(request: NextRequest): NextResponse {
  const incoming = request.headers.get('x-request-id');
  const requestId = isSafeRequestId(incoming) ? incoming : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('x-request-id', requestId);
  return response;
}

function isSafeRequestId(value: string | null): value is string {
  if (!value) return false;
  if (value.length < 1 || value.length > 128) return false;
  // Printable ASCII only, so a client can't inject control characters
  // into log output.
  return /^[\x20-\x7e]+$/.test(value);
}

export const config = {
  // Apply to every path except static assets and Next.js internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
