import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  createCommission,
  verifyCommission,
  approveCommission,
} from '@/services/commission.service';
import { createBatch } from '@/services/payout-batch.service';

import { GET as getCommissionsCsv } from '../commissions.csv/route';
import { GET as getPayoutsCsv } from '../payouts.csv/route';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('CSV exports', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentId: string;

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
      fullName: 'Awa Ngwa',
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
  });

  const req = (url: string, cookie?: string): Request =>
    new Request(url, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  async function seedOneApprovedCommission(customerId = 'CUST-001') {
    // const adminUser = {
    //   subjectType: 'ADMIN' as const,
    //   subjectId: String(new Types.ObjectId()),
    //   email: 'admin@epsihome.cm',
    //   name: 'Ops',
    //   profilePictureUrl: null,
    //   roles: ['ADMIN'],
    // };

    const adminUser = makeAdminUser();
    const c = await createCommission(adminUser, {
      agentId,
      coreCustomerId: customerId,
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });
    await verifyCommission(adminUser, c.id);
    await approveCommission(adminUser, c.id);
    return c;
  }

  it('commissions.csv returns 401 unauthenticated', async () => {
    const res = await getCommissionsCsv(req('http://x/api/reports/commissions.csv'), ctx);
    expect(res.status).toBe(401);
  });

  it('commissions.csv returns 403 for an agent session', async () => {
    const res = await getCommissionsCsv(
      req('http://x/api/reports/commissions.csv', agentSessionId),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it('commissions.csv returns CSV with headers and one row', async () => {
    await seedOneApprovedCommission();

    const res = await getCommissionsCsv(
      req('http://x/api/reports/commissions.csv', adminSessionId),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[0]!.startsWith('id,agentId,coreCustomerId')).toBe(true);
    expect(lines[1]!).toContain('CUST-001');
    expect(lines[1]!).toContain('APPROVED');
    expect(lines[1]!).toContain('950'); // net
  });

  it('commissions.csv writes an EXPORT audit row', async () => {
    await seedOneApprovedCommission();
    await getCommissionsCsv(req('http://x/api/reports/commissions.csv', adminSessionId), ctx);
    const audits = await AuditLog.find({ action: 'EXPORT' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.entityType).toBe('Report');
    expect(audits[0]!.entityId).toBe('commissions.csv');
    const after = audits[0]!.diff.after as { rowCount: number };
    expect(after.rowCount).toBe(1);
  });

  it('commissions.csv respects the status filter', async () => {
    await seedOneApprovedCommission('C-1');
    // const adminUser = {
    //   subjectType: 'ADMIN' as const,
    //   subjectId: String(new Types.ObjectId()),
    //   email: 'admin@epsihome.cm',
    //   name: 'Ops',
    //   profilePictureUrl: null,
    //   roles: ['ADMIN'],
    // };

    const adminUser = makeAdminUser();
    await createCommission(adminUser, {
      agentId,
      coreCustomerId: 'C-2',
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });

    const res = await getCommissionsCsv(
      req('http://x/api/reports/commissions.csv?status=APPROVED', adminSessionId),
      ctx,
    );
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2); // header + 1 APPROVED
  });

  it('payouts.csv returns CSV with headers and one row', async () => {
    // Seed 6 approved, then create a DRAFT batch.
    for (let i = 0; i < 6; i++) {
      await seedOneApprovedCommission(`C-${i}`);
    }
    // const adminUser = {
    //   subjectType: 'ADMIN' as const,
    //   subjectId: String(new Types.ObjectId()),
    //   email: 'admin@epsihome.cm',
    //   name: 'Ops',
    //   profilePictureUrl: null,
    //   roles: ['ADMIN'],
    // };
    const adminUser = makeAdminUser();
    await createBatch(adminUser, { agentId, period: '2026-09' });

    const res = await getPayoutsCsv(req('http://x/api/reports/payouts.csv', adminSessionId), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');

    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.startsWith('id,agentId,period')).toBe(true);
    expect(lines[1]!).toContain('2026-09');
    expect(lines[1]!).toContain('DRAFT');
    expect(lines[1]!).toContain('5700'); // total
  });

  it('payouts.csv writes an EXPORT audit row', async () => {
    await getPayoutsCsv(req('http://x/api/reports/payouts.csv', adminSessionId), ctx);
    const audits = await AuditLog.find({ action: 'EXPORT' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.entityId).toBe('payouts.csv');
  });
});
