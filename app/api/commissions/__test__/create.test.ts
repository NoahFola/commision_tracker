import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { Commission } from '@/models/commission.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { POST as createCommissionRoute } from '../route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('POST /api/commissions', () => {
  let adminSessionId: string;
  let agentId: string;

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
    //   AuditLog.deleteMany({}),
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
      commissionRate: 500,
    });
    agentId = String(agent._id);
  });

  const req = (body: unknown, cookie?: string): Request =>
    new Request('http://x/api/commissions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const ctx = { params: Promise.resolve({}) };

  const validBody = () => ({
    agentId,
    coreCustomerId: 'CUST-001',
    firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
    baseAmount: { amount: 20000, currency: 'XAF' },
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await createCommissionRoute(req(validBody()), ctx);
    expect(res.status).toBe(401);
  });

  it('creates a commission and returns 201', async () => {
    const res = await createCommissionRoute(req(validBody(), adminSessionId), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.period).toBe('2026-09');
    expect(body.data.netAmount.amount).toBe(950);
  });

  it('returns 400 for a malformed body', async () => {
    const res = await createCommissionRoute(
      new Request('http://x/api/commissions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}`,
        },
        body: 'not json',
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 on a duplicate (agent, customer, period)', async () => {
    await createCommissionRoute(req(validBody(), adminSessionId), ctx);
    const res = await createCommissionRoute(req(validBody(), adminSessionId), ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
  });
});