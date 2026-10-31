import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { PerformanceEvent } from '@/models/performance-event.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { GET as aggregatePerformance } from '../aggregate/route';
import { POST as createPerformance } from '../route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/performance/aggregate', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentId: string;
  let otherAgentId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    // await Promise.all([
    //   PerformanceEvent.deleteMany({}),
    //   Agent.deleteMany({}),
    //   Region.deleteMany({}),
    //   Admin.deleteMany({}),
    //   Session.deleteMany({}),
    //   AuditLog.deleteMany({}),
    // ]);
    await wipeAllCollections();

    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    adminSessionId = (await createSession({ type: 'ADMIN', id: admin._id })).sessionId;

    const region = await Region.create({ name: 'Douala' });
    const a1 = await Agent.create({
      fullName: 'Awa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    const a2 = await Agent.create({
      fullName: 'Bello',
      type: 'AGENT',
      email: 'bello@example.cm',
      phone: '+237600000001',
      regionId: region._id,
      referralCode: 'BEL01',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    agentId = String(a1._id);
    otherAgentId = String(a2._id);
    agentSessionId = (await createSession({ type: 'AGENT', id: a1._id })).sessionId;
  });

  const create = (body: unknown, cookie = adminSessionId): Promise<Response> =>
    createPerformance(
      new Request('http://x/api/performance', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({}) },
    );

  const aggregate = (qs = '', cookie = adminSessionId): Promise<Response> =>
    aggregatePerformance(
      new Request(`http://x/api/performance/aggregate${qs}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
      }),
      { params: Promise.resolve({}) },
    );

  const body = (
    target: string,
    dayKey: string,
    revenue: number,
    leads: number,
    overrides: Record<string, unknown> = {},
  ) => ({
    agentId: target,
    dayKey,
    revenueAttributed: { amount: revenue, currency: 'XAF' },
    leadsGenerated: leads,
    dealsClosed: 0,
    propertiesReferred: 0,
    landlordsOnboarded: 0,
    tenantsOnboarded: 0,
    ...overrides,
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await aggregatePerformance(new Request('http://x/api/performance/aggregate'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns an empty bucket list for a range with no events', async () => {
    const res = await aggregate('?from=2026-01-01&to=2026-01-31');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.buckets).toEqual([]);
    expect(json.data.from).toBe('2026-01-01');
    expect(json.data.to).toBe('2026-01-31');
    expect(json.data.granularity).toBe('daily');
  });

  it('aggregates daily buckets with summed counters and revenue', async () => {
    await create(body(agentId, '2026-09-28', 1000, 1));
    await create(body(agentId, '2026-09-29', 2000, 2));
    await create(body(agentId, '2026-09-30', 3000, 3));

    const res = await aggregate('?from=2026-09-01&to=2026-09-30&granularity=daily');
    const json = await res.json();
    expect(json.data.buckets).toHaveLength(3);
    expect(json.data.buckets.map((b: { periodKey: string }) => b.periodKey)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
    const totalRevenue = json.data.buckets.reduce(
      (s: number, b: { revenueAttributed: { amount: number } }) => s + b.revenueAttributed.amount,
      0,
    );
    expect(totalRevenue).toBe(6000);
    const totalLeads = json.data.buckets.reduce(
      (s: number, b: { leadsGenerated: number }) => s + b.leadsGenerated,
      0,
    );
    expect(totalLeads).toBe(6);
  });

  it('aggregates weekly buckets keyed by the WAT Monday', async () => {
    // 2026-09-28 is a Monday; 2026-09-30 is a Wednesday of the same week.
    // 2026-10-05 is a Monday of the following week.
    await create(body(agentId, '2026-09-28', 1000, 1));
    await create(body(agentId, '2026-09-30', 2000, 2));
    await create(body(agentId, '2026-10-05', 500, 1));

    const res = await aggregate('?from=2026-09-01&to=2026-10-31&granularity=weekly');
    const json = await res.json();
    expect(json.data.buckets).toHaveLength(2);
    expect(json.data.buckets[0].periodKey).toBe('2026-09-28');
    expect(json.data.buckets[0].revenueAttributed.amount).toBe(3000);
    expect(json.data.buckets[0].eventCount).toBe(2);
    expect(json.data.buckets[1].periodKey).toBe('2026-10-05');
    expect(json.data.buckets[1].revenueAttributed.amount).toBe(500);
  });

  it('aggregates monthly buckets keyed by YYYY-MM', async () => {
    await create(body(agentId, '2026-09-30', 1000, 1));
    await create(body(agentId, '2026-10-01', 2000, 2));

    const res = await aggregate('?from=2026-09-01&to=2026-10-31&granularity=monthly');
    const json = await res.json();
    expect(json.data.buckets).toHaveLength(2);
    expect(json.data.buckets[0].periodKey).toBe('2026-09');
    expect(json.data.buckets[1].periodKey).toBe('2026-10');
  });

  it('excludes superseded rows from rollups; corrected values win', async () => {
    const first = await create(body(agentId, '2026-09-30', 1000, 1));
    const firstId = (await first.json()).data.id as string;
    await create(
      body(agentId, '2026-09-30', 5000, 4, {
        supersedesId: firstId,
        reason: 'Correction',
      }),
    );

    const res = await aggregate('?from=2026-09-01&to=2026-09-30&granularity=daily');
    const json = await res.json();
    expect(json.data.buckets).toHaveLength(1);
    expect(json.data.buckets[0].revenueAttributed.amount).toBe(5000);
    expect(json.data.buckets[0].leadsGenerated).toBe(4);
    expect(json.data.buckets[0].eventCount).toBe(1);
  });

  it('echoes the granularity in the response', async () => {
    const res = await aggregate('?granularity=monthly');
    const json = await res.json();
    expect(json.data.granularity).toBe('monthly');
  });

  it('an agent sees only their own rows in the rollup', async () => {
    await create(body(agentId, '2026-09-30', 1000, 1));
    await create(body(otherAgentId, '2026-09-30', 9000, 9));

    const res = await aggregate(
      '?from=2026-09-01&to=2026-09-30&granularity=monthly',
      agentSessionId,
    );
    const json = await res.json();
    expect(json.data.buckets).toHaveLength(1);
    expect(json.data.buckets[0].revenueAttributed.amount).toBe(1000);
    expect(json.data.buckets[0].leadsGenerated).toBe(1);
  });

  it('rejects a mixed-currency bucket', async () => {
    await create(body(agentId, '2026-09-29', 1000, 1));
    await create(
      body(agentId, '2026-09-30', 500, 1, {
        revenueAttributed: { amount: 500, currency: 'USD' },
      }),
    );

    const res = await aggregate('?from=2026-09-01&to=2026-09-30&granularity=monthly');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('BAD_REQUEST');
  });

  it('rejects malformed query parameters with 400', async () => {
    expect((await aggregate('?from=bad')).status).toBe(400);
    expect((await aggregate('?granularity=hourly')).status).toBe(400);
    expect((await aggregate('?agentId=not-an-id')).status).toBe(400);
  });
});
