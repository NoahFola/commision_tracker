import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDb, disconnectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { Agent } from '@/models/agent.model';
import { createSession, SESSION_COOKIE_NAME } from '../session';
import { getCurrentUser } from '../current-user';
import { Types } from 'mongoose';
import { Region } from '@/models/region.model';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('getCurrentUser', () => {
  beforeAll(async () => {
    await connectDb();
  });

  afterAll(async () => {
    // Intentionally do NOT disconnect — the connection is shared across
    // test files in the worker. See vitest.setup.ts.
  });

  beforeEach(async () => {
    await Promise.all([Admin.deleteMany({}), Agent.deleteMany({}), Region.deleteMany({})]);
  });

  it('returns null when no cookie', async () => {
    const req = new Request('http://x/', { headers: {} });
    expect(await getCurrentUser(req)).toBeNull();
  });

  it('returns null for an unknown session ID', async () => {
    const req = new Request('http://x/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=nope` },
    });
    expect(await getCurrentUser(req)).toBeNull();
  });

  it('returns the admin identity for a valid admin session', async () => {
    const admin = await Admin.create({
      email: 'a@b.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    const { sessionId } = await createSession({ type: 'ADMIN', id: admin._id });
    const req = new Request('http://x/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    });
    const u = await getCurrentUser(req);
    expect(u?.subjectType).toBe('ADMIN');
    expect(u?.email).toBe('a@b.cm');
  });

  it('returns the agent identity for an ACTIVE agent session', async () => {
    const region = await Region.create({ name: 'Douala' });
    const agent = await Agent.create({
      fullName: 'Awa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      status: 'ACTIVE',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    const { sessionId } = await createSession({ type: 'AGENT', id: agent._id });
    const req = new Request('http://x/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    });
    const u = await getCurrentUser(req);
    expect(u?.subjectType).toBe('AGENT');
    if (u?.subjectType !== 'AGENT') throw new Error('expected agent');
expect(u.agentType).toBe('AGENT');
  });

  it('returns null for a SUSPENDED agent session', async () => {
    const region = await Region.create({ name: 'Yaoundé' });
    const agent = await Agent.create({
      fullName: 'S',
      type: 'AGENT',
      email: 's@x.cm',
      phone: '+237600000001',
      regionId: region._id,
      referralCode: 'S01',
      status: 'SUSPENDED',
      payoutPreference: { method: 'CASH' },
    });
    const { sessionId } = await createSession({ type: 'AGENT', id: agent._id });
    const req = new Request('http://x/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    });
    expect(await getCurrentUser(req)).toBeNull();
  });
});
