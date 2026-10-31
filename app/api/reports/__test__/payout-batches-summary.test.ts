import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import { AuditLog } from '@/models/audit-log.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  createCommission,
  verifyCommission,
  approveCommission,
} from '@/services/commission.service';
import {
  createBatch,
  approveBatch,
  markBatchProcessing,
  markBatchPaid,
} from '@/services/payout-batch.service';

import { GET as getBatchSummary } from '../payout-batches-summary/route';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('GET /api/reports/payout-batches-summary', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentId: string;
  let customerSeq = 0;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    await Promise.all([
      PayoutBatch.deleteMany({}),
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
    agentSessionId = (await createSession({ type: 'AGENT', id: agent._id })).sessionId;
    customerSeq = 0;
  });

  const req = (qs = '', cookie?: string): Request =>
    new Request(`http://x/api/reports/payout-batches-summary${qs}`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  // const adminUser = () => ({
  //   subjectType: 'ADMIN' as const,
  //   subjectId: String(new Types.ObjectId()),
  //   email: 'admin@epsihome.cm',
  //   name: 'Ops',
  //   profilePictureUrl: null,
  //   roles: ['ADMIN'],
  // });

  const adminUser = makeAdminUser();

  async function seedBatch(period: string, count: number): Promise<string> {
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      const c = await createCommission(adminUser, {
        agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: `${period}-15T10:00:00.000Z`,
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(adminUser, c.id);
      await approveCommission(adminUser, c.id);
    }
    const b = await createBatch(adminUser, { agentId, period });
    return b.id;
  }

  it('returns 401 unauthenticated', async () => {
    const res = await getBatchSummary(req(), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for an agent session', async () => {
    const res = await getBatchSummary(req('', agentSessionId), ctx);
    expect(res.status).toBe(403);
  });

  it('returns all five statuses with zeros when there are no batches', async () => {
    const res = await getBatchSummary(req('', adminSessionId), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const s of ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED']) {
      expect(body.data.buckets[s]).toEqual({
        count: 0,
        total: { amount: 0, currency: 'XAF' },
      });
    }
  });

  it('counts and totals one DRAFT batch', async () => {
    await seedBatch('2026-09', 6); // 6 * 950 = 5700
    const res = await getBatchSummary(req('', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.buckets.DRAFT.count).toBe(1);
    expect(body.data.buckets.DRAFT.total.amount).toBe(6 * 950);
    expect(body.data.buckets.DRAFT.total.currency).toBe('XAF');
    expect(body.data.buckets.APPROVED.count).toBe(0);
  });

  it('buckets by status correctly as batches advance', async () => {
    const b1 = await seedBatch('2026-09', 6);
    await approveBatch(adminUser, b1);
    const b2 = await seedBatch('2026-10', 7);
    await approveBatch(adminUser, b2);
    await markBatchProcessing(adminUser, b2);
    const b3 = await seedBatch('2026-11', 6);
    await approveBatch(adminUser, b3);
    await markBatchPaid(adminUser, b3, { paymentReference: 'MOMO-1' });

    const res = await getBatchSummary(req('', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.buckets.APPROVED.count).toBe(1);
    expect(body.data.buckets.PROCESSING.count).toBe(1);
    expect(body.data.buckets.PAID.count).toBe(1);
    expect(body.data.buckets.DRAFT.count).toBe(0);
  });

  it('filters by period', async () => {
    await seedBatch('2026-09', 6);
    await seedBatch('2026-10', 6);

    const res = await getBatchSummary(req('?period=2026-09', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.period).toBe('2026-09');
    expect(body.data.buckets.DRAFT.count).toBe(1);
    // Same again for the other period to prove the filter works.
    const res2 = await getBatchSummary(req('?period=2026-10', adminSessionId), ctx);
    const body2 = await res2.json();
    expect(body2.data.buckets.DRAFT.count).toBe(1);
  });

  it('rejects a malformed period', async () => {
    const res = await getBatchSummary(req('?period=2026/09', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });
});
