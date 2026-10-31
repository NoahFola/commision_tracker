import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

vi.mock('@/lib/db/mongoose', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/db/mongoose')>();
  return { ...original };
});

import { GET as listAgentsRoute } from '../route';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/agents', () => {
  let adminSessionId: string;

  beforeAll(async () => {
    await connectDb();
  });
  afterAll(async () => {
  // Intentionally do NOT disconnect — the connection is shared across
  // test files in the worker. See vitest.setup.ts.
});
  beforeEach(async () => {
    await Promise.all([
      Agent.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      Session.deleteMany({}),
    ]);
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    const { sessionId } = await createSession({ type: 'ADMIN', id: admin._id });
    adminSessionId = sessionId;
  });

  const req = (qs = ''): Request =>
    new Request(`http://x/api/agents${qs}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}` },
    });

  async function seedAgents(n: number, regionName = 'Douala') {
    const region = await Region.create({ name: regionName });
    const docs = Array.from({ length: n }, (_, i) => ({
      fullName: `Agent ${i}`,
      type: 'AGENT' as const,
      email: `agent${i}-${new Types.ObjectId().toHexString()}@example.cm`,
      phone: `+2376${String(i).padStart(8, '0')}`,
      regionId: region._id,
      referralCode: `R${i}-${new Types.ObjectId().toHexString().slice(0, 6)}`,
      status: 'ACTIVE' as const,
      onboardingStage: 'REGISTERED' as const,
      payoutPreference: { method: 'MOBILE_MONEY' as const },
    }));
    await Agent.insertMany(docs);
    return region;
  }

  it('returns 401 when unauthenticated', async () => {
    const res = await listAgentsRoute(new Request('http://x/api/agents'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns an empty page when there are no agents', async () => {
    const res = await listAgentsRoute(req(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.totalPages).toBe(0);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(10);
  });

  it('paginates correctly and populates region as { id, name }', async () => {
    await seedAgents(12, 'Douala');
    const res = await listAgentsRoute(req('?page=2&limit=10'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(12);
    expect(body.data.totalPages).toBe(2);

    const first = body.data.items[0];
    expect(first.region).toEqual({ id: expect.any(String), name: 'Douala' });
  });

  it('does not leak payoutPreference in list items', async () => {
    await seedAgents(1);
    const res = await listAgentsRoute(req(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.data.items[0]).not.toHaveProperty('payoutPreference');
  });

  it('filters by status', async () => {
    const region = await Region.create({ name: 'Yaoundé' });
    await Agent.create({
      fullName: 'Active One',
      type: 'AGENT',
      email: 'a@x.cm',
      phone: '+237600000001',
      regionId: region._id,
      referralCode: 'A1',
      status: 'ACTIVE',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    await Agent.create({
      fullName: 'Suspended One',
      type: 'AGENT',
      email: 's@x.cm',
      phone: '+237600000002',
      regionId: region._id,
      referralCode: 'S1',
      status: 'SUSPENDED',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });

    const res = await listAgentsRoute(req('?status=SUSPENDED'), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].status).toBe('SUSPENDED');
  });

  it('filters by type', async () => {
    const region = await Region.create({ name: 'Bafoussam' });
    await Agent.create({
      fullName: 'Amb',
      type: 'AMBASSADOR',
      email: 'amb@x.cm',
      phone: '+237600000010',
      regionId: region._id,
      referralCode: 'AMB1',
      payoutPreference: { method: 'CASH' },
    });
    await Agent.create({
      fullName: 'Ag',
      type: 'AGENT',
      email: 'ag@x.cm',
      phone: '+237600000011',
      regionId: region._id,
      referralCode: 'AG1',
      payoutPreference: { method: 'CASH' },
    });

    const res = await listAgentsRoute(req('?type=AMBASSADOR'), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].type).toBe('AMBASSADOR');
  });

  it('filters by regionId', async () => {
    const regionA = await Region.create({ name: 'Region A' });
    const regionB = await Region.create({ name: 'Region B' });

    await Agent.create({
      fullName: 'A',
      type: 'AGENT',
      email: 'a@x.cm',
      phone: '+237600000020',
      regionId: regionA._id,
      referralCode: 'RA1',
      payoutPreference: { method: 'CASH' },
    });
    await Agent.create({
      fullName: 'B',
      type: 'AGENT',
      email: 'b@x.cm',
      phone: '+237600000021',
      regionId: regionB._id,
      referralCode: 'RB1',
      payoutPreference: { method: 'CASH' },
    });

    const res = await listAgentsRoute(req(`?regionId=${String(regionA._id)}`), {
      params: Promise.resolve({}),
    });
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].region.name).toBe('Region A');
  });

  it('rejects an invalid limit', async () => {
    const res = await listAgentsRoute(req('?limit=7'), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects an invalid regionId', async () => {
    const res = await listAgentsRoute(req('?regionId=not-an-id'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });
});
