import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { Commission } from '@/models/commission.model';
import { AuditLog } from '@/models/audit-log.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  createCommission,
  verifyCommission,
  approveCommission,
} from '@/services/commission.service';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

import { GET as getSummary } from '../commissions-summary/route';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/reports/commissions-summary', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentAId: string;
  let agentBId: string;
  let customerSeq = 0;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    await Promise.all([
      Commission.deleteMany({}),
      Agent.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      Session.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    adminSessionId = (await createSession({ type: 'ADMIN', id: admin._id })).sessionId;

    const region = await Region.create({ name: 'Douala' });
    const a = await Agent.create({
      fullName: 'Awa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    const b = await Agent.create({
      fullName: 'Bello',
      type: 'AGENT',
      email: 'bello@example.cm',
      phone: '+237600000001',
      regionId: region._id,
      referralCode: 'BEL01',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    agentAId = String(a._id);
    agentBId = String(b._id);
    agentSessionId = (await createSession({ type: 'AGENT', id: a._id })).sessionId;
    customerSeq = 0;
  });

  const req = (qs = '', cookie?: string): Request =>
    new Request(`http://x/api/reports/commissions-summary${qs}`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  async function seedPending(agentId: string, count: number, period = '2026-09') {
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      await createCommission(makeAdminUser(), {
        agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: `${period}-15T10:00:00.000Z`,
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
    }
  }

  async function seedVerified(agentId: string, count: number, period = '2026-09') {
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      const c = await createCommission(makeAdminUser(), {
        agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: `${period}-15T10:00:00.000Z`,
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(makeAdminUser(), c.id);
    }
  }

  async function seedApproved(agentId: string, count: number, period = '2026-09') {
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      const c = await createCommission(makeAdminUser(), {
        agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: `${period}-15T10:00:00.000Z`,
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(makeAdminUser(), c.id);
      await approveCommission(makeAdminUser(), c.id);
    }
  }

  it('returns 401 unauthenticated', async () => {
    const res = await getSummary(req(''), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for an agent session', async () => {
    const res = await getSummary(req('', agentSessionId), ctx);
    expect(res.status).toBe(403);
  });

  it('returns zeros for all statuses when there are no commissions', async () => {
    const res = await getSummary(req('', adminSessionId), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const s of ['PENDING', 'VERIFIED', 'APPROVED', 'PAID']) {
      expect(body.data[s]).toEqual({
        count: 0,
        total: { amount: 0, currency: 'XAF' },
      });
    }
  });

  it('counts and totals commissions by status', async () => {
    await seedPending(agentAId, 2);
    await seedVerified(agentAId, 1);
    await seedApproved(agentAId, 3);

    const res = await getSummary(req('', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.PENDING.count).toBe(2);
    expect(body.data.PENDING.total.amount).toBe(2 * 950);
    expect(body.data.VERIFIED.count).toBe(1);
    expect(body.data.VERIFIED.total.amount).toBe(950);
    expect(body.data.APPROVED.count).toBe(3);
    expect(body.data.APPROVED.total.amount).toBe(3 * 950);
    expect(body.data.PAID.count).toBe(0);
  });

  it('aggregates across all agents when no agent filter', async () => {
    await seedPending(agentAId, 2);
    await seedPending(agentBId, 3);

    const res = await getSummary(req('', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.PENDING.count).toBe(5);
    expect(body.data.PENDING.total.amount).toBe(5 * 950);
  });

  it('filters by agentId', async () => {
    await seedPending(agentAId, 2);
    await seedPending(agentBId, 3);

    const res = await getSummary(req(`?agentId=${agentAId}`, adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.PENDING.count).toBe(2);
    expect(body.data.PENDING.total.amount).toBe(2 * 950);
  });

  it('filters by period', async () => {
    await seedPending(agentAId, 2, '2026-09');
    await seedPending(agentAId, 3, '2026-10');

    const res = await getSummary(req('?period=2026-09', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.PENDING.count).toBe(2);
    expect(body.data.PENDING.total.amount).toBe(2 * 950);
  });

  it('rejects a malformed period', async () => {
    const res = await getSummary(req('?period=2026/09', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed agentId', async () => {
    const res = await getSummary(req('?agentId=not-an-id', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('includes reversal mirror rows in their status and reflects negative amounts', async () => {
    // Create one approved commission, then reverse it.
    await seedApproved(agentAId, 1);

    const approvedCommission = await Commission.findOne({ status: 'APPROVED' }).lean<{
      _id: Types.ObjectId;
    }>();
    expect(approvedCommission).not.toBeNull();

    const { reverseCommission } = await import('@/services/commission.service');
    await reverseCommission(makeAdminUser(), String(approvedCommission!._id), 'Correction');

    const res = await getSummary(req(`?agentId=${agentAId}`, adminSessionId), ctx);
    const body = await res.json();

    // APPROVED status is unchanged: 1 commission, +950.
    expect(body.data.APPROVED.count).toBe(1);
    expect(body.data.APPROVED.total.amount).toBe(950);

    // PENDING holds the reversal mirror: 1 commission, -950.
    expect(body.data.PENDING.count).toBe(1);
    expect(body.data.PENDING.total.amount).toBe(-950);
  });
});
