import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '@/lib/db/mongoose';
import { Session } from '@/models/session.model';
import {
  createSession,
  readSession,
  refreshSession,
  revokeSession,
  revokeAllSessionsFor,
  buildSessionCookie,
  buildClearSessionCookie,
  readSessionCookieFromHeader,
} from '../session';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('session (uses MONGODB_URI_TEST)', () => {
  beforeAll(async () => {
    await connectDb();
  });

  afterAll(async () => {
    // Intentionally do NOT disconnect — the connection is shared across
    // test files in the worker. See vitest.setup.ts.
  });

  beforeEach(async () => {
    // await Session.deleteMany({});
    await wipeAllCollections()
  });

  const subject = () => ({ type: 'ADMIN' as const, id: new Types.ObjectId() });

  it('createSession returns an opaque ID and expiry', async () => {
    const { sessionId, expiresAt } = await createSession(subject());
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(20);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('readSession returns the row for a valid session', async () => {
    const { sessionId } = await createSession(subject());
    const s = await readSession(sessionId);
    expect(s).not.toBeNull();
    expect(s?.subjectType).toBe('ADMIN');
  });

  it('readSession returns null for unknown ID', async () => {
    expect(await readSession('nonexistent')).toBeNull();
  });

  it('readSession returns null for an idle-expired session and deletes it', async () => {
    const { sessionId } = await createSession(subject());
    await Session.updateOne(
      { _id: sessionId },
      { $set: { idleExpiresAt: new Date(Date.now() - 1000) } },
    );
    expect(await readSession(sessionId)).toBeNull();
    expect(await Session.findById(sessionId)).toBeNull();
  });

  it('readSession returns null for an absolutely-expired session', async () => {
    const { sessionId } = await createSession(subject());
    await Session.updateOne(
      { _id: sessionId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect(await readSession(sessionId)).toBeNull();
  });

  it('refreshSession extends the idle window', async () => {
    const { sessionId } = await createSession(subject());
    expect(await refreshSession(sessionId)).toBe(true);
  });

  it('revokeSession deletes one session, idempotently', async () => {
    const { sessionId } = await createSession(subject());
    await revokeSession(sessionId);
    expect(await readSession(sessionId)).toBeNull();
    await revokeSession(sessionId); // no throw
  });

  it('revokeAllSessionsFor deletes every session for a subject', async () => {
    const s = subject();
    await createSession(s);
    await createSession(s);
    await createSession({ type: 'ADMIN', id: new Types.ObjectId() });
    const deleted = await revokeAllSessionsFor(s.type, s.id);
    expect(deleted).toBe(2);
  });
});

describe('session cookie helpers (no DB)', () => {
  it('builds a Set-Cookie value with expected attributes', () => {
    const v = buildSessionCookie('abc', new Date('2030-01-01T00:00:00.000Z'));
    expect(v).toContain('epsihome_session=abc');
    expect(v).toContain('HttpOnly');
    expect(v).toContain('SameSite=Lax');
    expect(v).toContain('Path=/');
  });

  it('clears the cookie by setting an empty value and past expiry', () => {
    const v = buildClearSessionCookie();
    expect(v).toContain('epsihome_session=');
    expect(v).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('parses the cookie from a raw header', () => {
    expect(readSessionCookieFromHeader('epsihome_session=xyz')).toBe('xyz');
    expect(readSessionCookieFromHeader('a=1; epsihome_session=xyz; b=2')).toBe('xyz');
    expect(readSessionCookieFromHeader('other=1')).toBeNull();
    expect(readSessionCookieFromHeader(null)).toBeNull();
    expect(readSessionCookieFromHeader('epsihome_session=')).toBeNull();
  });
});
