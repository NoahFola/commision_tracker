import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { AuditLog } from '@/models/audit-log.model';
import { Commission } from '@/models/commission.model';
import { computeCommissionAmounts } from '../commission.service';
import { createCommission } from '../commission.service';
import type { AuthMeAdmin } from '@/types/auth';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('commission.service.createCommission', () => {
  let adminUser: AuthMeAdmin;
  let agentId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    await Promise.all([
      Commission.deleteMany({}),
      Agent.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    adminUser = {
      subjectType: 'ADMIN',
      subjectId: String(admin._id),
      email: 'admin@epsihome.cm',
      name: 'Ops',
      profilePictureUrl: null,
      roles: ['ADMIN'],
    };
    const region = await Region.create({ name: 'Douala' });
    const agent = await Agent.create({
      fullName: 'Awa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      payoutPreference: { method: 'MOBILE_MONEY' },
      commissionRate: 500, // 5%
    });
    agentId = String(agent._id);
  });

  const base = (overrides: Partial<Record<string, unknown>> = {}) => ({
    agentId,
    coreCustomerId: 'CUST-001',
    firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
    baseAmount: { amount: 20000, currency: 'XAF' as const },
    ...overrides,
  });

  it('creates a PENDING commission with computed amounts', async () => {
    const c = await createCommission(adminUser, base());
    expect(c.status).toBe('PENDING');
    expect(c.period).toBe('2026-09');
    expect(c.rateApplied).toBe(500);
    expect(c.platformFeeRateApplied).toBe(500);

    // Cross-check against the pure function — future refactors cannot drift.
    const expected = computeCommissionAmounts({ amount: 20000, currency: 'XAF' }, 500, 500);
    expect(c.grossAmount).toEqual(expected.grossAmount);
    expect(c.platformFee).toEqual(expected.platformFee);
    expect(c.netAmount).toEqual(expected.netAmount);
  });

  it('snapshots rates; changing the agent rate afterwards does not affect it', async () => {
    const c = await createCommission(adminUser, base());
    expect(c.rateApplied).toBe(500);

    await Agent.updateOne({ _id: agentId }, { $set: { commissionRate: 800 } });

    const stored = await Commission.findById(c.id).lean<{ rateApplied: number }>();
    expect(stored!.rateApplied).toBe(500);
  });

  it('derives period in WAT (month rolls over at WAT midnight)', async () => {
    // 2026-09-30T23:30:00Z is 00:30 WAT on 2026-10-01 → period should be 2026-10.
    const c = await createCommission(
      adminUser,
      base({ firstPaymentConfirmedAt: '2026-09-30T23:30:00.000Z' }),
    );
    expect(c.period).toBe('2026-10');
  });

  it('writes exactly one CREATE audit row', async () => {
    const c = await createCommission(adminUser, base());
    const audits = await AuditLog.find({ entityType: 'Commission' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('CREATE');
    expect(audits[0]!.entityId).toBe(c.id);
    const row = audits[0];
if (!row) throw new Error('expected an audit row');
expect(row.diff.before).toBeNull();
    expect((audits[0]!.diff.after as { status: string }).status).toBe('PENDING');
  });

  it('rejects a nonexistent agent', async () => {
    await expect(
      createCommission(adminUser, base({ agentId: new Types.ObjectId().toHexString() })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a TERMINATED agent', async () => {
    await Agent.updateOne({ _id: agentId }, { $set: { status: 'TERMINATED' } });
    await expect(createCommission(adminUser, base())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('allows a SUSPENDED agent', async () => {
    await Agent.updateOne({ _id: agentId }, { $set: { status: 'SUSPENDED' } });
    const c = await createCommission(adminUser, base());
    expect(c.status).toBe('PENDING');
  });

  it('returns 409 on a duplicate (agent, customer, period)', async () => {
    await createCommission(adminUser, base());
    await expect(createCommission(adminUser, base())).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(await Commission.countDocuments({})).toBe(1);
  });

  it('allows the same customer in different periods', async () => {
    await createCommission(
      adminUser,
      base({ firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z' }),
    );
    await createCommission(
      adminUser,
      base({ firstPaymentConfirmedAt: '2026-10-15T10:00:00.000Z' }),
    );
    expect(await Commission.countDocuments({})).toBe(2);
  });

  it('allows a reversal row for the same (agent, customer, period) as the original', async () => {
    const original = await createCommission(adminUser, base());

    // Simulate a reversal row directly, since createCommission always
    // writes a non-reversal row (reversals land in Step 5.3).
    await Commission.create({
      agentId: new Types.ObjectId(agentId),
      coreCustomerId: 'CUST-001',
      firstPaymentConfirmedAt: new Date('2026-09-15T10:00:00.000Z'),
      period: '2026-09',
      baseAmount: { amount: -20000, currency: 'XAF' },
      rateApplied: 500,
      platformFeeRateApplied: 500,
      grossAmount: { amount: -1000, currency: 'XAF' },
      platformFee: { amount: -50, currency: 'XAF' },
      netAmount: { amount: -950, currency: 'XAF' },
      status: 'PENDING',
      reversesCommissionId: new Types.ObjectId(original.id),
      reason: 'Reversal for test',
      createdBy: new Types.ObjectId(adminUser.subjectId),
    });

    expect(await Commission.countDocuments({})).toBe(2);
  });

  it('preserves currency on every amount', async () => {
    const c = await createCommission(
      adminUser,
      base({ baseAmount: { amount: 100, currency: 'USD' } }),
    );
    expect(c.baseAmount.currency).toBe('USD');
    expect(c.grossAmount.currency).toBe('USD');
    expect(c.platformFee.currency).toBe('USD');
    expect(c.netAmount.currency).toBe('USD');
  });
});
