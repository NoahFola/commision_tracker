import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { connectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { wipeAllCollections } from '@/test/helpers/wipe-db';
import { POST as createCommissionRoute, GET as listCommissions } from '../route';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/commissions', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentId: string;
  let otherAgentId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    // await Promise.all([
    //   Commission.deleteMany({}),
    //   Agent.deleteMany({}),
    //   Region.deleteMany({}),
    //   Admin.deleteMany({}),
    //   Session.deleteMany({}),
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
  });

  const postReq = (body: unknown): Request =>
    new Request('http://x/api/commissions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}`,
      },
      body: JSON.stringify(body),
    });

  const listReq = (qs = '', cookie = adminSessionId): Request =>
    new Request(`http://x/api/commissions${qs}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });

  const ctx = { params: Promise.resolve({}) };

  const createFor = (target: string, cust: string) =>
    createCommissionRoute(
      postReq({
        agentId: target,
        coreCustomerId: cust,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      }),
      ctx,
    );

  it('returns 401 when unauthenticated', async () => {
    const res = await listCommissions(new Request('http://x/api/commissions'), ctx);
    expect(res.status).toBe(401);
  });

  it('admin sees all commissions', async () => {
    await createFor(agentId, 'CUST-001');
    await createFor(otherAgentId, 'CUST-002');
    const res = await listCommissions(listReq(), ctx);
    const body = await res.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
  });

  it('admin filters by agentId', async () => {
    await createFor(agentId, 'CUST-001');
    await createFor(otherAgentId, 'CUST-002');
    const res = await listCommissions(listReq(`?agentId=${otherAgentId}`), ctx);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(otherAgentId);
  });

  it('agent sees only their own', async () => {
    await createFor(agentId, 'CUST-001');
    await createFor(otherAgentId, 'CUST-002');
    const res = await listCommissions(listReq('', agentSessionId), ctx);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(agentId);
  });

  it('agent who requests another agentId is silently narrowed', async () => {
    await createFor(otherAgentId, 'CUST-002');
    const res = await listCommissions(listReq(`?agentId=${otherAgentId}`, agentSessionId), ctx);
    const body = await res.json();
    expect(body.data.items).toHaveLength(0);
  });

  it('rejects malformed query parameters with 400', async () => {
    expect((await listCommissions(listReq('?limit=7'), ctx)).status).toBe(400);
    expect((await listCommissions(listReq('?status=WHATEVER'), ctx)).status).toBe(400);
    expect((await listCommissions(listReq('?period=2026/09'), ctx)).status).toBe(400);
  });

  it('response shape is Paginated', async () => {
    await createFor(agentId, 'CUST-001');
    const res = await listCommissions(listReq(), ctx);
    const body = await res.json();
    const keys = Object.keys(body.data).sort();
    expect(keys).toEqual(['items', 'limit', 'page', 'total', 'totalPages']);
  });
});
