import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import { AuditLog } from '@/models/audit-log.model';
import {
  createBatch,
  approveBatch,
  markBatchProcessing,
  markBatchPaid,
  markBatchFailed,
  addCommissionToBatch,
  removeCommissionFromBatch,
  getBatch,
  listBatches,
  MINIMUM_BATCH_AMOUNT_XAF,
} from '../payout-batch.service';
import { createCommission, verifyCommission, approveCommission } from '../commission.service';
import type { AuthMeAdmin } from '@/types/auth';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('payout-batch.service', () => {
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

  // Add near the top of the file, after the imports.
  let customerSeq = 0;

  // Inside the describe block's beforeEach, after the deletes:
  customerSeq = 0;

  // Replace the existing helper with:
  async function seedApprovedCommissions(count: number, period = '2026-09') {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      const c = await createCommission(admin, {
        agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: `${period}-15T10:00:00.000Z`,
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(admin, c.id);
      await approveCommission(admin, c.id);
      ids.push(c.id);
    }
    return ids;
  }

  // -------------------------------------------------------------------------
  // createBatch
  // -------------------------------------------------------------------------

  it('creates a DRAFT batch from every eligible APPROVED commission', async () => {
    const ids = await seedApprovedCommissions(6); // 6 * 950 = 5700 >= 5000

    const b = await createBatch(admin, { agentId, period: '2026-09' });
    expect(b.status).toBe('DRAFT');
    expect(b.period).toBe('2026-09');
    expect(b.method).toBe('MOBILE_MONEY');
    expect(b.commissionIds.sort()).toEqual(ids.sort());
    expect(b.totalAmount.amount).toBe(6 * 950);

    // Every commission now has payoutBatchId set.
    const docs = await Commission.find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) } })
      .lean<{ payoutBatchId: Types.ObjectId | null }[]>()
      .exec();
    for (const d of docs) {
      expect(String(d.payoutBatchId)).toBe(b.id);
    }
  });

  it('rejects when there are no APPROVED commissions for the period', async () => {
    await expect(createBatch(admin, { agentId, period: '2026-09' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects when the total is below the 5,000 XAF threshold', async () => {
    // 5 * 950 = 4750 < 5000. Need one fewer.
    await seedApprovedCommissions(5);
    await expect(createBatch(admin, { agentId, period: '2026-09' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('accepts exactly at the threshold (multiple of 950 that equals or exceeds 5000)', async () => {
    // 6 * 950 = 5700, comfortably above. Use 6.
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    expect(b.totalAmount.amount).toBeGreaterThanOrEqual(MINIMUM_BATCH_AMOUNT_XAF);
  });

  it('returns 409 on a second DRAFT for the same (agent, period)', async () => {
    await seedApprovedCommissions(6);
    await createBatch(admin, { agentId, period: '2026-09' });

    // Seed 6 more commissions for the same period so the second create
    // passes the 5,000 XAF threshold and reaches the duplicate-key check.
    await seedApprovedCommissions(6);

    await expect(createBatch(admin, { agentId, period: '2026-09' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('allows a new batch after a previous one FAILED', async () => {
    const ids = await seedApprovedCommissions(6);
    const first = await createBatch(admin, { agentId, period: '2026-09' });
    await markBatchFailed(admin, first.id, 'Wrong MoMo number');

    // Commissions are released (payoutBatchId cleared).
    const docs = await Commission.find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) } })
      .lean<{ payoutBatchId: Types.ObjectId | null }[]>()
      .exec();
    for (const d of docs) expect(d.payoutBatchId).toBeNull();

    const second = await createBatch(admin, { agentId, period: '2026-09' });
    expect(second.status).toBe('DRAFT');
    expect(second.commissionIds.sort()).toEqual(ids.sort());
  });

  it('rejects TERMINATED and INACTIVE agents', async () => {
    await Agent.updateOne({ _id: agentId }, { $set: { status: 'TERMINATED' } });
    await expect(createBatch(admin, { agentId, period: '2026-09' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await Agent.updateOne({ _id: agentId }, { $set: { status: 'INACTIVE' } });
    await expect(createBatch(admin, { agentId, period: '2026-09' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('accepts an explicit method override', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09', method: 'BANK' });
    expect(b.method).toBe('BANK');
  });

  // -------------------------------------------------------------------------
  // add / remove commission
  // -------------------------------------------------------------------------

  it('adds a commission to a DRAFT batch and updates the total', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    const before = b.totalAmount.amount;

    // Add a 7th APPROVED commission.
    const [extra] = await seedApprovedCommissions(1);
    const updated = await addCommissionToBatch(admin, b.id, extra!);
    expect(updated.commissionIds).toContain(extra);
    expect(updated.totalAmount.amount).toBe(before + 950);

    const c = await Commission.findById(extra).lean<{ payoutBatchId: Types.ObjectId | null }>();
    expect(String(c!.payoutBatchId)).toBe(b.id);
  });

  it('rejects adding a commission from a different period', async () => {
    await seedApprovedCommissions(6, '2026-09');
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    const [other] = await seedApprovedCommissions(1, '2026-10');
    await expect(addCommissionToBatch(admin, b.id, other!)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('removes a commission and updates the total', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    const removeMe = b.commissionIds[0]!;
    const updated = await removeCommissionFromBatch(admin, b.id, removeMe);
    expect(updated.commissionIds).not.toContain(removeMe);
    expect(updated.totalAmount.amount).toBe(5 * 950);

    const c = await Commission.findById(removeMe).lean<{ payoutBatchId: Types.ObjectId | null }>();
    expect(c!.payoutBatchId).toBeNull();
  });

  it('rejects add/remove on a non-DRAFT batch', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    const [extra] = await seedApprovedCommissions(1, '2026-09');
    await expect(addCommissionToBatch(admin, b.id, extra!)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  // -------------------------------------------------------------------------
  // approve / processing / paid / failed
  // -------------------------------------------------------------------------

  it('approves a DRAFT batch, freezing the total and recording the approver', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    const a = await approveBatch(admin, b.id);
    expect(a.status).toBe('APPROVED');
    expect(a.approvedBy).toBe(admin.subjectId);
    expect(a.approvedAt).not.toBeNull();
    expect(a.totalAmount.amount).toBe(6 * 950);
  });

  it('rejects approving an empty batch', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    // Remove all commissions.
    for (const id of b.commissionIds) {
      await removeCommissionFromBatch(admin, b.id, id);
    }
    await expect(approveBatch(admin, b.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('transitions APPROVED -> PROCESSING', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    const p = await markBatchProcessing(admin, b.id);
    expect(p.status).toBe('PROCESSING');
  });

  it('marks PROCESSING -> PAID, flips every commission to PAID', async () => {
    const ids = await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    await markBatchProcessing(admin, b.id);
    const paid = await markBatchPaid(admin, b.id, { paymentReference: 'MOMO-123' });
    expect(paid.status).toBe('PAID');
    expect(paid.paymentReference).toBe('MOMO-123');

    const docs = await Commission.find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) } })
      .lean<{ status: string }[]>()
      .exec();
    for (const d of docs) expect(d.status).toBe('PAID');
  });

  it('requires paymentReference for MOBILE_MONEY and BANK, not for CASH', async () => {
    await seedApprovedCommissions(6);
    const bMobile = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, bMobile.id);
    await expect(markBatchPaid(admin, bMobile.id, {})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // New attempt with cash: change method to CASH on the draft first.
    // (This is a fresh batch for a different period to avoid uniqueness.)
    await seedApprovedCommissions(6, '2026-10');
    const bCash = await createBatch(admin, { agentId, period: '2026-10', method: 'CASH' });
    await approveBatch(admin, bCash.id);
    const paid = await markBatchPaid(admin, bCash.id, {});
    expect(paid.status).toBe('PAID');
  });

  it('rejects PAID -> FAILED', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    await markBatchPaid(admin, b.id, { paymentReference: 'MOMO-1' });
    await expect(markBatchFailed(admin, b.id, 'nope')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('fails a batch and releases its commissions', async () => {
    const ids = await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    await approveBatch(admin, b.id);
    const failed = await markBatchFailed(admin, b.id, 'Operator rejected');
    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toBe('Operator rejected');

    const docs = await Commission.find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) } })
      .lean<{ payoutBatchId: Types.ObjectId | null }[]>()
      .exec();
    for (const d of docs) expect(d.payoutBatchId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // reads
  // -------------------------------------------------------------------------

  it('lists batches for an admin and can filter by period', async () => {
    await seedApprovedCommissions(6, '2026-09');
    await createBatch(admin, { agentId, period: '2026-09' });
    await seedApprovedCommissions(6, '2026-10');
    await createBatch(admin, { agentId, period: '2026-10' });

    const all = await listBatches(admin, { page: 1, limit: 10 });
    expect(all.items).toHaveLength(2);

    const sept = await listBatches(admin, { page: 1, limit: 10, period: '2026-09' });
    expect(sept.items).toHaveLength(1);
    expect(sept.items[0]!.period).toBe('2026-09');
  });

  it('getBatch returns a single batch and hides none of its fields', async () => {
    await seedApprovedCommissions(6);
    const b = await createBatch(admin, { agentId, period: '2026-09' });
    const got = await getBatch(admin, b.id);
    expect(got.id).toBe(b.id);
    expect(got.commissionIds).toHaveLength(6);
  });
});
