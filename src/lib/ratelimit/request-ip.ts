/**
 * Extracts the client IP from a request. On Vercel, `x-forwarded-for`
 * is set by the platform and is trustworthy; in other environments the
 * leftmost value of `x-forwarded-for` is the standard best-effort.
 *
 * Falls back to a stable string when nothing is available, so the
 * limiter still has a key to work with (all anonymous callers share
 * one bucket, which is the correct fallback: we would rather rate-limit
 * aggressively than have no limit at all).
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
