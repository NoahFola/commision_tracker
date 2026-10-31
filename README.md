# EpsiHome Agent & Ambassador Tracker

Internal operations tool for tracking agent/ambassador performance and commissions.
Source of truth for payouts. Not a payments processor. Not a CRM.

## Setup
1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in the names shown.
3. `npm run dev`
4. Health check: `GET /api/health` → `{ "ok": true, "data": { "status": "ok" } }`

## Scripts
- `npm run dev` / `build` / `start`
- `npm run lint` / `format` / `format:check` / `typecheck`
- `npm test` (Vitest)

## Folder structure
- `src/app/` — routes (App Router)
- `src/components/` — shared UI
- `src/lib/db/` — Mongo connection (globally cached, Vercel-safe)
- `src/lib/auth/` — auth helpers (types only for now)
- `src/lib/errors/` — AppError classes + response envelope helpers
- `src/lib/validation/` — input validators
- `src/lib/audit/` — the ONLY place audit rows are written
- `src/models/` — Mongoose schemas
- `src/services/` — business logic
- `src/types/` — shared types

## Non-negotiable conventions

### Money
- Integers only, in the smallest currency unit (XAF = whole units; USD/EUR = cents).
- **Never floats.**
- Every amount carries a currency. Amount without currency is a bug.

### Time
- All period boundaries (daily/weekly/monthly) are **WAT (UTC+1)**.
- Store timestamps as UTC; convert at the boundary helpers only.

### API responses
- Success: `{ ok: true, data }`
- Failure: `{ ok: false, error: { code, message } }`
- Use helpers in `src/lib/errors/respond.ts`. Never hand-roll a response shape.

### Audit
- Every financial/performance mutation writes an audit row via `src/lib/audit/`.
- No service or route writes audit rows any other way.

### Authorization
- Object-level, server-side, every route. Client checks are cosmetic.

### Data
- Commissions immutable after approval; corrections = reverse + append.
- No hard deletes. Soft-delete or reverse.
- Multi-document writes use MongoDB transactions.

## Planned dependencies (not yet installed)
- `@upstash/redis` — rate limiting and non-user-scoped caching (Phase 2+/9).
  Never cache authenticated, user-scoped data in Redis.

## Known gaps (deliberately out of scope for now)
- Taxes / legal compliance.
- Multi-tenancy.
- Payments execution (we record results; a separate service transfers).


## Database

The MongoDB connection is established lazily and cached globally.
Two mechanisms exist, both correct:

1. `instrumentation.ts` — runs once per server process, warms the connection
   before the first request. This is also where the bootstrap admin will be
   seeded (Phase 2).
2. `withDb(fn)` — call from route handlers and services before touching models.
   The safety net for cold-started serverless instances.

DO NOT call `connectDb()` from `layout.tsx`, `page.tsx`, or any React component.
Layouts and pages render on every request (including unauthenticated ones),
and a DB call there breaks static rendering and inflates cold-start cost.

### Indexes

`autoIndex` is `true` in development and `false` in production. In production,
build indexes explicitly:

    npm run db:sync-indexes

Run this after any schema change that affects an index, and in CI.


## Auth

- Email + password. `bcryptjs`, cost factor 12.
- Server-side sessions in MongoDB. Cookie name: `epsihome_session`.
  - Cookie holds only an opaque 32-byte session ID.
  - Sliding idle TTL: 7 days. Absolute TTL: 30 days.
  - `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`.
- Two login routes (Phase 2, Step 2.3): `/api/auth/admin/login`,
  `/api/auth/agent/login`.
- Rate limiting deferred to Phase 9 (Upstash).

### Test database

Session integration tests require `MONGODB_URI_TEST` in `.env.local`.
When absent, those tests are skipped (unit tests still run).

## Auth endpoints

| Method | Path                     | Purpose                     |
|--------|--------------------------|-----------------------------|
| POST   | /api/auth/admin/login    | Admin login (email + pw)    |
| POST   | /api/auth/agent/login    | Agent/Ambassador login      |
| POST   | /api/auth/logout         | Revoke session, clear cookie|
| GET    | /api/auth/me             | Current identity            |

Cookie: `epsihome_session` — opaque session ID, HttpOnly, SameSite=Lax,
Secure in production. Sliding idle TTL 7d; absolute TTL 30d.

Login failures return the same generic `{ ok: false, error: { code: 'UNAUTHORIZED',
message: 'Invalid credentials' } }` regardless of cause (no user enumeration).


## Bootstrap admin

The first admin is seeded from environment variables at server start
(via `instrumentation.ts`). No self-signup exists.

Required env vars (see `.env.example`):
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`  (min 10 chars, max 72 bytes)
- `BOOTSTRAP_ADMIN_NAME`

Behavior:
- If all three are set and no Admin with that email exists → creates one.
- If an Admin with that email already exists → no-op (idempotent).
- If any env var is missing → no-op (no crash; logs in dev).
- **Changing `BOOTSTRAP_ADMIN_PASSWORD` after the admin exists does NOT
  rotate the password.** The env var is a first-run seed, not a password
  manager. Explicit password changes come later (admin UI / one-off script).

Safety: concurrent serverless cold starts are handled by the unique index
on `Admin.email`. The loser of the race gets a duplicate-key error, which
is caught and treated as "already exists".


## Environment files

Next.js automatically loads `.env.local` (and `.env`, `.env.development`, etc.)
for the app. **Standalone scripts and test runners do not** — they must load it
explicitly:

- `db:sync-indexes` runs via `tsx` with `--env-file=.env.local` (see package.json).
- Vitest loads it via `envFile: '.env.local'` in `vitest.config.ts`.

### Quoting rule

Any env value containing `#` must be quoted. Unquoted, `#` starts a comment
and silently truncates the value:

    BOOTSTRAP_ADMIN_PASSWORD="Charles#1996$"   # parsed correctly
    BOOTSTRAP_ADMIN_PASSWORD=Charles#1996$     # parsed as just "Charles"

Single quotes work too. This rule applies to every env file.