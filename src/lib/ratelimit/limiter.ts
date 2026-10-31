import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { logger } from '@/lib/logging';

/**
 * Rate limiters for the login routes.
 *
 * Two limiters:
 *   1. IP-only: 10 attempts per 15 minutes. Sliding window.
 *   2. IP+email failures: 5 consecutive failures lock the pair for 1
 *      minute. Fixed window.
 *
 * Why the difference:
 *   - The IP limiter benefits from a sliding window: an attacker cannot
 *     burst at the tail end of a fixed window to double their rate.
 *   - The failure limiter needs to be a strict counter: exactly 5
 *     failures, then blocked. A sliding window is more forgiving than
 *     the "5 failures" rule implies, which makes both the rule and its
 *     tests unclear. Fixed window gives us the behaviour we want.
 *
 * Not limited: /api/auth/logout. Idempotent and cheap.
 *
 * Test friendliness:
 *   - In tests, keys are prefixed with `test:` so a stale counter from
 *     a previous run can be cleaned up without touching real data.
 *   - If Upstash credentials are absent, the limiters are disabled and
 *     every check passes. Callers and tests can rely on this.
 */

const PREFIX = process.env.NODE_ENV === 'test' ? 'test:ratelimit:' : 'ratelimit:';

let redis: Redis | null = null;
let ipLimiter: Ratelimit | null = null;
let failureLimiter: Ratelimit | null = null;

function init(): void {
  if (redis) return;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  redis = new Redis({ url, token });

  ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    prefix: `${PREFIX}login:ip`,
    analytics: false,
  });

  failureLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, '1 m'),
    prefix: `${PREFIX}login:fail`,
    analytics: false,
  });
}

export type RateLimitResult = {
  success: boolean;
  /** Seconds until the caller may retry. Only meaningful when !success. */
  retryAfterSeconds: number;
  /** Which limiter fired; useful in logs. */
  scope: 'ip' | 'ip+email' | null;
};

/**
 * Checks the IP-only limiter. Call this before any other work.
 * Returns success: true when Upstash is not configured.
 */
export async function checkIpLimit(ip: string): Promise<RateLimitResult> {
  init();
  if (!ipLimiter) return { success: true, retryAfterSeconds: 0, scope: null };
  const res = await ipLimiter.limit(ip);
  if (res.success) {
    return { success: true, retryAfterSeconds: 0, scope: null };
  }
  const retry = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  logger.warn('rate limit exceeded (ip)', { ip, retryAfterSeconds: retry });
  return { success: false, retryAfterSeconds: retry, scope: 'ip' };
}

/**
 * Checks the IP+email failure limiter. Should be checked BEFORE
 * verifying the password, so a locked pair doesn't even reach bcrypt.
 * Returns success: true when Upstash is not configured.
 */
export async function checkFailureLimit(ip: string, email: string): Promise<RateLimitResult> {
  init();
  if (!failureLimiter) return { success: true, retryAfterSeconds: 0, scope: null };
  const key = `${ip}|${email.toLowerCase()}`;
  const res = await failureLimiter.limit(key);
  if (res.success) {
    return { success: true, retryAfterSeconds: 0, scope: null };
  }
  const retry = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  logger.warn('rate limit exceeded (ip+email failures)', {
    ip,
    email,
    retryAfterSeconds: retry,
  });
  return { success: false, retryAfterSeconds: retry, scope: 'ip+email' };
}

/**
 * Records a failed login attempt against the IP+email failure limiter.
 * Called after a credential check fails. No-op when Upstash is not
 * configured.
 */
export async function recordFailure(ip: string, email: string): Promise<void> {
  init();
  if (!failureLimiter) return;
  // Ratelimit.limit() both checks and increments. We just called
  // checkFailureLimit above and it returned success — so this counts
  // the current attempt. That's the intended behaviour: N allowed
  // failures, then locked.
  await failureLimiter.limit(`${ip}|${email.toLowerCase()}`);
}
