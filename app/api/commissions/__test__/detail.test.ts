import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { Commission } from '@/models/commission.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { GET as getCommissionRoute } from '../[id]/route';
import { POST as createCommissionRoute } from '../route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/commissions/[id]', () => {
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
    adminSessionId = (
      await createSession({ type: 'ADMIN', id: admin._id })
    ).sessionId;
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

  const req = (id: string, cookie: string): Request =>
    new Request(`http://x/api/commissions/${id}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 401 when unauthenticated', async () => {
    const res = await getCommissionRoute(
      new Request(`http://x/api/commissions/${commissionId}`),
      ctx(commissionId),
    );
    expect(res.status).toBe(401);
  });

  it('admin can read any commission', async () => {
    const res = await getCommissionRoute(req(commissionId, adminSessionId), ctx(commissionId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(commissionId);
    expect(body.data.status).toBe('PENDING');
  });

  it('the owning agent can read their own', async () => {
    const res = await getCommissionRoute(req(commissionId, agentSessionId), ctx(commissionId));
    expect(res.status).toBe(200);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await getCommissionRoute(req('not-an-id', adminSessionId), ctx('not-an-id'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a valid but unknown id', async () => {
    const bogus = new Types.ObjectId().toHexString();
    const res = await getCommissionRoute(req(bogus, adminSessionId), ctx(bogus));
    expect(res.status).toBe(404);
  });
});