import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { Commission } from '@/models/commission.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { POST as createCommissionRoute } from '../route';
import { POST as verifyRoute } from '../[id]/verify/route';
import { POST as approveRoute } from '../[id]/approve/route';
import { POST as reverseRoute } from '../[id]/reverse/route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('commission transition routes', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentId: string;
  let commissionId: string;

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
    const agent = await Agent.create({
      fullName: 'Awa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    agentId = String(agent._id);
    agentSessionId = (await createSession({ type: 'AGENT', id: agent._id })).sessionId;

    const created = await createCommissionRoute(
      new Request('http://x/api/commissions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}`,
        },
        body: JSON.stringify({
          agentId,
          coreCustomerId: 'CUST-001',
          firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
          baseAmount: { amount: 20000, currency: 'XAF' },
        }),
      }),
      { params: Promise.resolve({}) },
    );
    commissionId = (await created.json()).data.id;
  });

  const bareReq = (id: string, path: string, cookie: string, body?: unknown): Request =>
    new Request(`http://x/api/commissions/${id}/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('verify: PENDING -> VERIFIED, 200', async () => {
    const res = await verifyRoute(
      bareReq(commissionId, 'verify', adminSessionId),
      ctx(commissionId),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('VERIFIED');
  });

  it('verify: agent session -> 403', async () => {
    const res = await verifyRoute(
      bareReq(commissionId, 'verify', agentSessionId),
      ctx(commissionId),
    );
    expect(res.status).toBe(403);
  });

  it('verify: unauthenticated -> 401', async () => {
    const res = await verifyRoute(
      new Request(`http://x/api/commissions/${commissionId}/verify`, { method: 'POST' }),
      ctx(commissionId),
    );
    expect(res.status).toBe(401);
  });

  it('verify: twice -> 400', async () => {
    await verifyRoute(bareReq(commissionId, 'verify', adminSessionId), ctx(commissionId));
    const res = await verifyRoute(
      bareReq(commissionId, 'verify', adminSessionId),
      ctx(commissionId),
    );
    expect(res.status).toBe(400);
  });

  it('approve: cannot skip verify -> 400', async () => {
    const res = await approveRoute(
      bareReq(commissionId, 'approve', adminSessionId),
      ctx(commissionId),
    );
    expect(res.status).toBe(400);
  });

  it('approve: VERIFIED -> APPROVED, 200', async () => {
    await verifyRoute(bareReq(commissionId, 'verify', adminSessionId), ctx(commissionId));
    const res = await approveRoute(
      bareReq(commissionId, 'approve', adminSessionId),
      ctx(commissionId),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('APPROVED');
  });

  it('reverse: 201 with a mirror row', async () => {
    await verifyRoute(bareReq(commissionId, 'verify', adminSessionId), ctx(commissionId));
    await approveRoute(bareReq(commissionId, 'approve', adminSessionId), ctx(commissionId));
    const res = await reverseRoute(
      bareReq(commissionId, 'reverse', adminSessionId, { reason: 'Wrong customer' }),
      ctx(commissionId),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.reversesCommissionId).toBe(commissionId);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.netAmount.amount).toBe(-950);
  });

  it('reverse: missing reason -> 400', async () => {
    const res = await reverseRoute(
      bareReq(commissionId, 'reverse', adminSessionId, {}),
      ctx(commissionId),
    );
    expect(res.status).toBe(400);
  });

  it('reverse: PAID commission -> 400', async () => {
    await verifyRoute(bareReq(commissionId, 'verify', adminSessionId), ctx(commissionId));
    await approveRoute(bareReq(commissionId, 'approve', adminSessionId), ctx(commissionId));
    await Commission.updateOne({ _id: commissionId }, { $set: { status: 'PAID' } });
    const res = await reverseRoute(
      bareReq(commissionId, 'reverse', adminSessionId, { reason: 'Too late' }),
      ctx(commissionId),
    );
    expect(res.status).toBe(400);
  });
});
