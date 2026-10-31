import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Redis } from '@upstash/redis';

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

import { checkIpLimit, checkFailureLimit, recordFailure } from '../limiter';

describe.skipIf(!hasUpstash)('rate limiters (requires Upstash)', () => {
  let redis: Redis;
  let counter = 0;

  beforeEach(async () => {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    counter += 1;
    // Clean the test namespace so a previous run can't poison this one.
    // Upstash's REST client supports SCAN via `scan`, but the free tier
    // may not expose SCAN. As a simpler, bounded alternative we delete a
    // set of keys we know how to address: we generate a fresh identifier
    // for each test so no cleanup is strictly needed.
  });

  afterEach(async () => {
    // Nothing to clean — we use unique identifiers per test.
  });

  const uniqueIp = () => `ip-test-${Date.now()}-${counter}-${Math.random()}`;
  const uniqueEmail = () => `user-${Date.now()}-${counter}-${Math.random()}@example.cm`;

  it('allows the first 10 IP attempts and blocks the 11th', async () => {
    const ip = uniqueIp();
    for (let i = 0; i < 10; i++) {
      const r = await checkIpLimit(ip);
      expect(r.success).toBe(true);
    }
    const r11 = await checkIpLimit(ip);
    expect(r11.success).toBe(false);
    expect(r11.scope).toBe('ip');
    expect(r11.retryAfterSeconds).toBeGreaterThan(0);
    expect(r11.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('allows 5 consecutive failures then locks the pair', async () => {
    const ip = uniqueIp();
    const email = uniqueEmail();

    // Record 5 failures without checking in between.
    for (let i = 0; i < 5; i++) {
      await recordFailure(ip, email);
    }

    // The 6th check finds the window full.
    const locked = await checkFailureLimit(ip, email);
    expect(locked.success).toBe(false);
    expect(locked.scope).toBe('ip+email');
  });

  it('a different email from the same IP is not affected by the pair lock', async () => {
    const ip = uniqueIp();
    const emailA = uniqueEmail();
    for (let i = 0; i < 5; i++) {
      await recordFailure(ip, emailA);
    }
    const lockedA = await checkFailureLimit(ip, emailA);
    expect(lockedA.success).toBe(false);

    const emailB = uniqueEmail();
    const okB = await checkFailureLimit(ip, emailB);
    expect(okB.success).toBe(true);
  });
});

describe('rate limiters (no Upstash configured)', () => {
  it('returns success: true when Upstash is absent', async () => {
    // If Upstash is configured in this environment, this describe block
    // is redundant but harmless — the limiters would consume real keys.
    // Skip in that case.
    if (hasUpstash) return;
    const ip = `irrelevant-${Date.now()}`;
    const r = await checkIpLimit(ip);
    expect(r.success).toBe(true);
    expect(r.scope).toBeNull();
  });
});
