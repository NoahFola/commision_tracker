import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import { AuditLog } from '@/models/audit-log.model';
import { createCommission, verifyCommission, approveCommission } from '../commission.service';
import { createBatch, approveBatch, markBatchPaid, markBatchFailed } from '../payout-batch.service';
// import { assertNoUnpaidCommissions, getUnpaidBalance } from '../commission.service';
import type { AuthMeAdmin } from '@/types/auth';
// ADD these two lines:
import { getUnpaidBalance } from '../commission.service';
import { assertNoUnpaidCommissions } from '../agent.service';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('PayoutBatch <-> Commission integration', () => {
  let admin: AuthMeAdmin;
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
      AuditLog.deleteMany({}),
    ]);
    await wipeAllCollections()
    const a = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    admin = {
      subjectType: 'ADMIN',
      subjectId: String(a._id),
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
      commissionRate: 500,
    });
    agentId = String(agent._id);
  });

  async function seedApproved(count: number) {
    for (let i = 0; i < count; i++) {
      const c = await createCommission(admin, {
        agentId,
        coreCustomerId: `CUST-${i}`,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(admin, c.id);
      await approveCommission(admin, c.id);
    }
  }

  it('a PAID batch flips every commission to PAID and clears the unpaid balance', async () => {
    await seedApproved(6);
    const balanceBefore = await getUnpaidBalance(agentId);
    expect(balanceBefore.total).toBe(6 * 950);
    expect(balanceBefore.count).toBe(6);

    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    await markBatchPaid(admin, b.id, { paymentReference: 'MOMO-TEST-1' });

    const balanceAfter = await getUnpaidBalance(agentId);
    expect(balanceAfter.total).toBe(0);
    expect(balanceAfter.count).toBe(0);
  });

  it('the terminate guard passes once the batch is PAID', async () => {
    await seedApproved(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    await markBatchPaid(admin, b.id, { paymentReference: 'MOMO-TEST-1' });

    // No unpaid commissions remain; the guard resolves.
    await expect(assertNoUnpaidCommissions(new Types.ObjectId(agentId))).resolves.toBeUndefined();
  });

  it('a FAILED batch releases commissions; the guard still blocks termination', async () => {
    await seedApproved(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    await markBatchFailed(admin, b.id, 'MoMo operator rejected');

    // Commissions are released and still APPROVED -> unpaid.
    const balance = await getUnpaidBalance(agentId);
    expect(balance.total).toBe(6 * 950);
    expect(balance.count).toBe(6);

    // The guard rejects.
    await expect(assertNoUnpaidCommissions(new Types.ObjectId(agentId))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('a PAID commission cannot be added to another batch', async () => {
    await seedApproved(6);
    const b1 = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b1.id);
    await markBatchPaid(admin, b1.id, { paymentReference: 'MOMO-TEST-1' });

    // Seed ENOUGH fresh commissions for October to clear the 5000 XAF minimum
    // (6 × 950 = 5700 XAF).
    for (let i = 0; i < 6; i++) {
      const c = await createCommission(admin, {
        agentId,
        coreCustomerId: `CUST-NEW-${i}`,
        firstPaymentConfirmedAt: '2026-10-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(admin, c.id);
      await approveCommission(admin, c.id);
    }

    const b2 = await createBatch(admin, { agentId, period: '2026-10' });
    const paidCommission = b1.commissionIds[0]!;
    await expect(
      import('../payout-batch.service').then((m) =>
        m.addCommissionToBatch(admin, b2.id, paidCommission),
      ),
    ).rejects.toBeTruthy();
  });

  it('a PAID batch cannot be failed', async () => {
    await seedApproved(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    await markBatchPaid(admin, b.id, { paymentReference: 'MOMO-TEST-1' });

    await expect(markBatchFailed(admin, b.id, 'too late')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
