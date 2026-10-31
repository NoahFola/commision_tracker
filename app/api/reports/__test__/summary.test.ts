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

import { GET as getSummary } from '../summary/route';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI);

let customerSeq = 0

describe.skipIf(!hasTestDb)('GET /api/reports/summary', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentAId: string;
  let agentBId: string;

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
    customerSeq = 0
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
      commissionRate: 500,
    });
    const b = await Agent.create({
      fullName: 'Bello',
      type: 'AGENT',
      email: 'bello@example.cm',
      phone: '+237600000001',
      regionId: region._id,
      referralCode: 'BEL01',
      payoutPreference: { method: 'MOBILE_MONEY' },
      commissionRate: 500,
    });
    agentAId = String(a._id);
    agentBId = String(b._id);
    agentSessionId = (await createSession({ type: 'AGENT', id: a._id })).sessionId;
  });

  const req = (qs: string, cookie?: string): Request =>
    new Request(`http://x/api/reports/summary${qs}`, {
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

  async function seed(agentId: string, count: number, verify = false, approve = false) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const c = await createCommission(adminUser, {
        agentId,
        coreCustomerId: `C-${++customerSeq}`,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      if (verify) await verifyCommission(adminUser, c.id);
      if (approve) await approveCommission(adminUser, c.id);
      ids.push(c.id);
    }
    return ids;
  }

  it('returns 401 unauthenticated', async () => {
    const res = await getSummary(req('?period=2026-09'), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for an agent session', async () => {
    const res = await getSummary(req('?period=2026-09', agentSessionId), ctx);
    expect(res.status).toBe(403);
  });

  it('requires a period', async () => {
    const res = await getSummary(req('', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed period', async () => {
    const res = await getSummary(req('?period=2026/09', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('returns rows for agents with no activity when includeEmpty is true (default)', async () => {
    const res = await getSummary(req('?period=2026-09', adminSessionId), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.period).toBe('2026-09');
    expect(body.data.rows).toHaveLength(2); // both agents
    for (const r of body.data.rows) {
      expect(r.counts.pending).toBe(0);
      expect(r.counts.approved).toBe(0);
      expect(r.counts.paid).toBe(0);
      expect(r.amounts.pending.net).toBe(0);
    }
  });

  it('skips agents with no activity when includeEmpty is false', async () => {
    await seed(agentAId, 2, false, false); // 2 pending
    const res = await getSummary(req('?period=2026-09&includeEmpty=false', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].agentId).toBe(agentAId);
  });

  it('sums commissions by status bucket', async () => {
    await seed(agentAId, 2, false, false); // 2 pending
    await seed(agentAId, 1, true, false); // 1 verified
    await seed(agentAId, 3, true, true); // 3 approved
    // amounts: pending bucket = 2 + 1 = 3 commissions × net 950 = 2850
    //          approved bucket = 3 × 950 = 2850

    const res = await getSummary(req('?period=2026-09', adminSessionId), ctx);
    const body = await res.json();
    const row = body.data.rows.find((r: { agentId: string }) => r.agentId === agentAId);
    expect(row.counts.pending).toBe(2);
    expect(row.counts.verified).toBe(1);
    expect(row.counts.approved).toBe(3);
    expect(row.amounts.pending.net).toBe(3 * 950);
    expect(row.amounts.approved.net).toBe(3 * 950);
    expect(row.amounts.paid.net).toBe(0);
  });

  it('computes totals across all agents', async () => {
    await seed(agentAId, 2, false, false);
    await seed(agentBId, 3, true, true);

    const res = await getSummary(req('?period=2026-09', adminSessionId), ctx);
    const body = await res.json();
    expect(body.data.totals.counts.pending).toBe(2);
    expect(body.data.totals.counts.approved).toBe(3);
    expect(body.data.totals.amounts.pending.net).toBe(2 * 950);
    expect(body.data.totals.amounts.approved.net).toBe(3 * 950);
  });

  it('only includes commissions from the requested period', async () => {
    await seed(agentAId, 2, false, false);
    // Create an October commission; it must not appear in the September summary.
    await createCommission(adminUser, {
      agentId: agentAId,
      coreCustomerId: 'OCT-1',
      firstPaymentConfirmedAt: '2026-10-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });

    const res = await getSummary(req('?period=2026-09', adminSessionId), ctx);
    const body = await res.json();
    const row = body.data.rows.find((r: { agentId: string }) => r.agentId === agentAId);
    expect(row.counts.pending).toBe(2); // only September
  });
});
