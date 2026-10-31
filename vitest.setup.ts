/**
 * Vitest setup — runs once per worker process.
 *
 * Responsibilities:
 *   1. Ensure BCRYPT_COST is low so test seeds don't dominate runtime.
 *   2. Point the app's Mongo connection at the test DB.
 *   3. Refuse to run if MONGODB_URI_TEST equals MONGODB_URI.
 *
 * Note: we do NOT disconnect between test files. The global cached
 * connection persists across files in a worker; disconnecting and
 * reconnecting 25 times per run would exhaust Atlas's free-tier
 * connection limits and produce the "Could not connect to any servers"
 * cascade we saw in earlier runs. The connection is closed when the
 * worker exits.
 */

// Rate limiting is disabled in tests. Two reasons:
//   1. Every auth test would consume the same IP bucket and hit 429.
//   2. It would make tests slow (network round trip to Upstash).
// The rate limiter is tested separately in limiter.test.ts, which
// reads the env vars directly and requires them to be present there.
if (process.env.RATE_LIMIT_TESTS !== 'true') {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

// Force the test environment. .env.local may contain NODE_ENV, which
// would override Vitest's own setting. Vitest is not the dev server.
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

// bcrypt cost override — must run before any module imports password.ts.
process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? '4';

// Safety: if MONGODB_URI somehow points at a real cluster, refuse.
// (The global setup should have overwritten it, but a misconfiguration
// here would be dangerous — tests call deleteMany({}).)
const uri = process.env.MONGODB_URI ?? '';
if (!uri.startsWith('mongodb://127.0.0.1:') && !uri.startsWith('mongodb://localhost:')) {
  throw new Error(
    `Refusing to run tests: MONGODB_URI does not point at the in-memory test database.\n` +
      `Got: ${uri.replace(/:[^:@]+@/, ':****@')}\n` +
      `This usually means vitest.global-setup.ts did not run.`,
  );
}
