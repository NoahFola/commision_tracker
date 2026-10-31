import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { AuditLog } from '@/models/audit-log.model';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import {
  setupCommissionFixtures,
  type CommissionFixtures,
} from '@/services/__test__/commission-fixtures';
import {
  createCommission,
  verifyCommission,
  approveCommission,
} from '@/services/commission.service';

import { GET as getCommissionsCsv } from '../commissions.csv/route';
import { GET as getPayoutsCsv } from '../payouts.csv/route';
import { GET as getSummary } from '../summary/route';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('Phase 8 cross-cutting: status, scope, and format', () => {
  let fx: CommissionFixtures;
  let customerSeq = 0;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    fx = await setupCommissionFixtures();
    customerSeq = 0;
  });

  const req = (url: string, cookie?: string): Request =>
    new Request(url, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  // const adminUser = () => ({
  //   subjectType: 'ADMIN' as const,
  //   subjectId: fx.adminId,
  //   email: 'admin@epsihome.cm',
  //   name: 'Ops',
  //   profilePictureUrl: null,
  //   roles: ['ADMIN'],
  // });

  const adminUser = makeAdminUser();

  async function seedApproved(count: number, period = '2026-09') {
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      const c = await createCommission(adminUser, {
        agentId: fx.agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: `${period}-15T10:00:00.000Z`,
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(adminUser, c.id);
      await approveCommission(adminUser, c.id);
    }
  }

  // -- 401 matrix ----------------------------------------------------------

  it('all reporting endpoints return 401 without a session', async () => {
    const cases: Promise<Response>[] = [
      getCommissionsCsv(req('http://x/api/reports/commissions.csv'), ctx),
      getPayoutsCsv(req('http://x/api/reports/payouts.csv'), ctx),
      getSummary(req('http://x/api/reports/summary?period=2026-09'), ctx),
    ];
    for (const p of cases) {
      expect((await p).status).toBe(401);
    }
  });

  // -- 403 matrix ----------------------------------------------------------

  it('all reporting endpoints return 403 for an agent session', async () => {
    const cases: Promise<Response>[] = [
      getCommissionsCsv(req('http://x/api/reports/commissions.csv', fx.agentSessionId), ctx),
      getPayoutsCsv(req('http://x/api/reports/payouts.csv', fx.agentSessionId), ctx),
      getSummary(req('http://x/api/reports/summary?period=2026-09', fx.agentSessionId), ctx),
    ];
    for (const p of cases) {
      expect((await p).status).toBe(403);
    }
  });

  // -- 200 matrix + format -------------------------------------------------

  it('commissions.csv returns 200 with the correct content type for an admin', async () => {
    await seedApproved(1);
    const res = await getCommissionsCsv(
      req('http://x/api/reports/commissions.csv', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('.csv');
  });

  it('payouts.csv returns 200 with the correct content type for an admin', async () => {
    const res = await getPayoutsCsv(
      req('http://x/api/reports/payouts.csv', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('.csv');
  });

  it('summary returns 200 with the standard envelope for an admin', async () => {
    const res = await getSummary(
      req('http://x/api/reports/summary?period=2026-09', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('data');
    expect(body).not.toHaveProperty('error');
  });

  // -- Envelope on failure -------------------------------------------------

  it('summary returns the standard envelope on failure', async () => {
    const res = await getSummary(
      req('http://x/api/reports/summary?period=invalid', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });

  // -- CSV content ---------------------------------------------------------

  it('commissions.csv header row matches the documented column order', async () => {
    await seedApproved(1);
    const res = await getCommissionsCsv(
      req('http://x/api/reports/commissions.csv', fx.adminSessionId),
      ctx,
    );
    const text = await res.text();
    const [headerLine] = text.split('\r\n');
    expect(headerLine).toBe(
      'id,agentId,coreCustomerId,period,status,baseAmount,grossAmount,platformFee,netAmount,currency,rateApplied,createdAt,paidAt',
    );
  });

  it('payouts.csv header row matches the documented column order', async () => {
    const res = await getPayoutsCsv(
      req('http://x/api/reports/payouts.csv', fx.adminSessionId),
      ctx,
    );
    const text = await res.text();
    const [headerLine] = text.split('\r\n');
    expect(headerLine).toBe(
      'id,agentId,period,status,method,commissionCount,totalAmount,currency,paymentReference,createdAt,approvedAt,paidAt',
    );
  });

  // -- EXPORT audit rows ---------------------------------------------------

  it('each CSV export writes exactly one EXPORT audit row', async () => {
    await seedApproved(2);
    await getCommissionsCsv(req('http://x/api/reports/commissions.csv', fx.adminSessionId), ctx);
    await getPayoutsCsv(req('http://x/api/reports/payouts.csv', fx.adminSessionId), ctx);
    const audits = await AuditLog.find({ action: 'EXPORT' }).sort({ at: 1 });
    expect(audits).toHaveLength(2);
    expect(audits[0]!.entityId).toBe('commissions.csv');
    expect(audits[1]!.entityId).toBe('payouts.csv');
  });

  // -- Summary semantics --------------------------------------------------

  it('summary includes agents with no activity by default', async () => {
    const res = await getSummary(
      req('http://x/api/reports/summary?period=2026-09', fx.adminSessionId),
      ctx,
    );
    const body = await res.json();
    // Two agents exist (fx.agentId, fx.otherAgentId).
    expect(body.data.rows).toHaveLength(2);
    for (const row of body.data.rows) {
      expect(row.amounts.pending.net).toBe(0);
      expect(row.amounts.approved.net).toBe(0);
    }
  });

  it('summary skips empty agents when includeEmpty=false', async () => {
    await seedApproved(2);
    const res = await getSummary(
      req('http://x/api/reports/summary?period=2026-09&includeEmpty=false', fx.adminSessionId),
      ctx,
    );
    const body = await res.json();
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].agentId).toBe(fx.agentId);
  });

  it('summary folds VERIFIED into the pending money bucket', async () => {
    // 2 pending + 1 verified → pending bucket = 3 × 950 net
    for (let i = 0; i < 2; i++) {
      customerSeq += 1;
      await createCommission(adminUser, {
        agentId: fx.agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
    }
    customerSeq += 1;
    const verifiedCandidate = await createCommission(adminUser, {
      agentId: fx.agentId,
      coreCustomerId: `CUST-${customerSeq}`,
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });
    await verifyCommission(adminUser, verifiedCandidate.id);

    const res = await getSummary(
      req('http://x/api/reports/summary?period=2026-09', fx.adminSessionId),
      ctx,
    );
    const body = await res.json();
    const row = body.data.rows.find((r: { agentId: string }) => r.agentId === fx.agentId);
    expect(row.counts.pending).toBe(2);
    expect(row.counts.verified).toBe(1);
    expect(row.amounts.pending.net).toBe(3 * 950); // folded
    expect(row.amounts.approved.net).toBe(0);
  });

  it('summary includes region as { id, name }', async () => {
    const res = await getSummary(
      req('http://x/api/reports/summary?period=2026-09', fx.adminSessionId),
      ctx,
    );
    const body = await res.json();
    const row = body.data.rows.find((r: { agentId: string }) => r.agentId === fx.agentId);
    expect(row.region).toEqual({ id: fx.regionId, name: 'Douala' });
  });

  it('summary throws 400 when one agent has commissions in two currencies in the same period', async () => {
    // Two commissions, same agent, same period, different currencies.
    customerSeq += 1;
    await createCommission(adminUser, {
      agentId: fx.agentId,
      coreCustomerId: `CUST-${customerSeq}`,
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });
    customerSeq += 1;
    await createCommission(adminUser, {
      agentId: fx.agentId,
      coreCustomerId: `CUST-${customerSeq}`,
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 100, currency: 'USD' },
    });

    const res = await getSummary(
      req('http://x/api/reports/summary?period=2026-09', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  // -- Sanity: no cross-agent leakage in exports --------------------------

  it('commissions.csv only includes commissions the filter allows', async () => {
    await seedApproved(2);
    // Seed one commission for the other agent.
    customerSeq += 1;
    await createCommission(adminUser, {
      agentId: fx.otherAgentId,
      coreCustomerId: `CUST-${customerSeq}`,
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });

    const res = await getCommissionsCsv(
      req(`http://x/api/reports/commissions.csv?agentId=${fx.agentId}`, fx.adminSessionId),
      ctx,
    );
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    // header + 2 rows (only fx.agentId's commissions)
    expect(lines).toHaveLength(3);
    for (const line of lines.slice(1)) {
      expect(line).toContain(fx.agentId);
    }
  });
});
