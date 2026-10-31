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

import { GET as listPerformance, POST as createPerformance } from '../route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/performance', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let otherAgentSessionId: string;
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

    await wipeAllCollections()

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
    otherAgentSessionId = (await createSession({ type: 'AGENT', id: a2._id })).sessionId;
  });

  const list = (qs = '', cookie = adminSessionId): Promise<Response> =>
    listPerformance(
      new Request(`http://x/api/performance${qs}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
      }),
      { params: Promise.resolve({}) },
    );

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

  const baseBody = (
    targetAgentId: string,
    dayKey: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    agentId: targetAgentId,
    dayKey,
    revenueAttributed: { amount: 1000, currency: 'XAF' },
    leadsGenerated: 1,
    dealsClosed: 0,
    propertiesReferred: 0,
    landlordsOnboarded: 0,
    tenantsOnboarded: 0,
    ...overrides,
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await listPerformance(new Request('http://x/api/performance'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns paginated items for an admin across all agents', async () => {
    await create(baseBody(agentId, '2026-09-28'));
    await create(baseBody(otherAgentId, '2026-09-29'));
    await create(baseBody(agentId, '2026-09-30'));

    const res = await list('?from=2026-09-01&to=2026-09-30');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(3);
    expect(body.data.total).toBe(3);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(10);
    expect(body.data.totalPages).toBe(1);
  });

  it('paginates correctly', async () => {
    for (let i = 0; i < 7; i++) {
      await create(baseBody(agentId, `2026-09-${String(20 + i).padStart(2, '0')}`));
    }
    const page1 = await list('?from=2026-09-01&to=2026-09-30&limit=5&page=1');
    const b1 = await page1.json();
    expect(b1.data.items).toHaveLength(5);
    expect(b1.data.totalPages).toBe(2);

    const page2 = await list('?from=2026-09-01&to=2026-09-30&limit=5&page=2');
    const b2 = await page2.json();
    expect(b2.data.items).toHaveLength(2);
  });

  it('filters by agentId', async () => {
    await create(baseBody(agentId, '2026-09-28'));
    await create(baseBody(otherAgentId, '2026-09-29'));

    const res = await list(`?agentId=${otherAgentId}&from=2026-09-01&to=2026-09-30`);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(otherAgentId);
  });

  it('filters by date range', async () => {
    await create(baseBody(agentId, '2026-08-31'));
    await create(baseBody(agentId, '2026-09-15'));
    await create(baseBody(agentId, '2026-10-01'));

    const res = await list('?from=2026-09-01&to=2026-09-30');
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].dayKey).toBe('2026-09-15');
  });

  it('onlyCurrent=true (default) hides superseded rows', async () => {
    const first = await create(baseBody(agentId, '2026-09-30'));
    const firstId = (await first.json()).data.id as string;
    await create(
      baseBody(agentId, '2026-09-30', {
        revenueAttributed: { amount: 3000, currency: 'XAF' },
        supersedesId: firstId,
        reason: 'Correction',
      }),
    );

    const res = await list('?from=2026-09-01&to=2026-09-30');
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].revenueAttributed.amount).toBe(3000);
  });

  it('onlyCurrent=false exposes the full history', async () => {
    const first = await create(baseBody(agentId, '2026-09-30'));
    const firstId = (await first.json()).data.id as string;
    await create(
      baseBody(agentId, '2026-09-30', {
        revenueAttributed: { amount: 3000, currency: 'XAF' },
        supersedesId: firstId,
        reason: 'Correction',
      }),
    );

    const res = await list('?from=2026-09-01&to=2026-09-30&onlyCurrent=false');
    const body = await res.json();
    expect(body.data.items).toHaveLength(2);
    // Each row carries an isCurrent flag.
    const byIsCurrent = body.data.items.map((i: { isCurrent: boolean }) => i.isCurrent);
    expect(byIsCurrent.filter((v: boolean) => v).length).toBe(1);
    expect(byIsCurrent.filter((v: boolean) => !v).length).toBe(1);
  });

  it('an agent sees only their own rows', async () => {
    await create(baseBody(agentId, '2026-09-28'));
    await create(baseBody(otherAgentId, '2026-09-29'));

    const res = await list('?from=2026-09-01&to=2026-09-30', agentSessionId);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(agentId);
  });

  it('an agent who requests another agentId is silently narrowed to their own', async () => {
    await create(baseBody(otherAgentId, '2026-09-29'));

    // agentSessionId belongs to agentId, but we ask for otherAgentId.
    const res = await list(
      `?agentId=${otherAgentId}&from=2026-09-01&to=2026-09-30`,
      agentSessionId,
    );
    const body = await res.json();
    // No leak: nothing returned, because the caller has no rows.
    expect(body.data.items).toHaveLength(0);
  });

  it('other agent sees their own rows via their session', async () => {
    await create(baseBody(agentId, '2026-09-28'));
    await create(baseBody(otherAgentId, '2026-09-29'));

    const res = await list('?from=2026-09-01&to=2026-09-30', otherAgentSessionId);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(otherAgentId);
  });

  it('rejects malformed query parameters with 400', async () => {
    expect((await list('?from=bad')).status).toBe(400);
    expect((await list('?limit=7')).status).toBe(400);
    expect((await list('?agentId=not-an-id')).status).toBe(400);
  });

  it('response shape is a Paginated envelope', async () => {
    await create(baseBody(agentId, '2026-09-30'));
    const res = await list('?from=2026-09-01&to=2026-09-30');
    const body = await res.json();
    const keys = Object.keys(body.data).sort();
    expect(keys).toEqual(['items', 'limit', 'page', 'total', 'totalPages']);
  });
});
