import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { AuditLog } from '@/models/audit-log.model';
import { Commission } from '@/models/commission.model';
import {
  createCommission,
  verifyCommission,
  approveCommission,
  reverseCommission,
} from '../commission.service';
import type { AuthMeAdmin } from '@/types/auth';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('commission transitions', () => {
  let adminA: AuthMeAdmin;
  let adminB: AuthMeAdmin;
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
    const a = await Admin.create({
      email: 'admin-a@epsihome.cm',
      name: 'A',
      passwordHash: 'x'.repeat(60),
    });
    const b = await Admin.create({
      email: 'admin-b@epsihome.cm',
      name: 'B',
      passwordHash: 'x'.repeat(60),
    });
    adminA = {
      subjectType: 'ADMIN',
      subjectId: String(a._id),
      email: 'admin-a@epsihome.cm',
      name: 'A',
      profilePictureUrl: null,
      roles: ['ADMIN'],
    };
    adminB = {
      subjectType: 'ADMIN',
      subjectId: String(b._id),
      email: 'admin-b@epsihome.cm',
      name: 'B',
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

  const makeCommission = () =>
    createCommission(adminA, {
      agentId,
      coreCustomerId: 'CUST-001',
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });

  // verify ------------------------------------------------------------

  it('verify: PENDING -> VERIFIED, sets actor and timestamp, writes VERIFY audit', async () => {
    const c = await makeCommission();
    const v = await verifyCommission(adminA, c.id);
    expect(v.status).toBe('VERIFIED');
    expect(v.verifiedBy).toBe(adminA.subjectId);
    expect(v.verifiedAt).not.toBeNull();
    expect(v.approvedBy).toBeNull();

    const audits = await AuditLog.find({ entityType: 'Commission', action: 'VERIFY' }).lean<
      { diff: { before: { status?: string } | null; after: { status?: string } | null } }[]
    >();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.diff.before?.status).toBe('PENDING');
    expect(audits[0]?.diff.after?.status).toBe('VERIFIED');
  });

  it('verify: already VERIFIED -> 400', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await expect(verifyCommission(adminB, c.id)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('verify: on APPROVED -> 400', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    await expect(verifyCommission(adminA, c.id)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('verify: unknown id -> 404', async () => {
    await expect(
      verifyCommission(adminA, new Types.ObjectId().toHexString()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('verify: malformed id -> 400', async () => {
    await expect(verifyCommission(adminA, 'not-an-id')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  // approve -----------------------------------------------------------

  it('approve: VERIFIED -> APPROVED, sets actor and timestamp, writes APPROVE audit', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    const ap = await approveCommission(adminB, c.id);
    expect(ap.status).toBe('APPROVED');
    expect(ap.approvedBy).toBe(adminB.subjectId);
    expect(ap.approvedAt).not.toBeNull();

    const audits = await AuditLog.find({ entityType: 'Commission', action: 'APPROVE' });
    expect(audits).toHaveLength(1);
  });

  it('approve: on PENDING -> 400 (cannot skip verify)', async () => {
    const c = await makeCommission();
    await expect(approveCommission(adminA, c.id)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('approve: already APPROVED -> 400', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    await expect(approveCommission(adminA, c.id)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('same admin may perform verify and approve (dual control, same actor allowed)', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    const ap = await approveCommission(adminA, c.id);
    expect(ap.verifiedBy).toBe(adminA.subjectId);
    expect(ap.approvedBy).toBe(adminA.subjectId);
  });

  // reverse -----------------------------------------------------------

  it('reverse: creates a mirror with negative amounts, original untouched', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);

    const mirror = await reverseCommission(adminA, c.id, 'Duplicate entry');

    expect(mirror.reversesCommissionId).toBe(c.id);
    expect(mirror.status).toBe('PENDING');
    expect(mirror.baseAmount.amount).toBe(-c.baseAmount.amount);
    expect(mirror.grossAmount.amount).toBe(-c.grossAmount.amount);
    expect(mirror.platformFee.amount).toBe(-c.platformFee.amount);
    expect(mirror.netAmount.amount).toBe(-c.netAmount.amount);
    expect(mirror.reason).toBe('Duplicate entry');

    // Original is unchanged.
    const stored = await Commission.findById(c.id).lean<{
      status: string;
      reversesCommissionId: unknown;
      netAmount: { amount: number };
    }>();
    expect(stored!.status).toBe('APPROVED');
    expect(stored!.reversesCommissionId).toBeNull();
    expect(stored!.netAmount.amount).toBe(c.netAmount.amount);
  });

  it('reverse: writes a REVERSE audit row for the mirror', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    const mirror = await reverseCommission(adminA, c.id, 'Wrong customer');
    const audits = await AuditLog.find({ entityType: 'Commission', action: 'REVERSE' }).lean<
      { entityId: string; reason?: string }[]
    >();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.entityId).toBe(mirror.id);
    expect(audits[0]?.reason).toBe('Wrong customer');
  });

  it('reverse: PAID commission -> 400 (post-payment is a Phase 6 clawback)', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    // Fast-forward: mark PAID directly (Phase 6 will do this via the batch flow).
    await Commission.updateOne({ _id: c.id }, { $set: { status: 'PAID' } });
    await expect(reverseCommission(adminA, c.id, 'Nope')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('reverse: of a reversal -> 400', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    const mirror = await reverseCommission(adminA, c.id, 'First reversal');
    await expect(
      reverseCommission(adminA, mirror.id, 'Reversal of reversal'),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('reverse: 404 for unknown id', async () => {
    await expect(
      reverseCommission(adminA, new Types.ObjectId().toHexString(), 'Nope'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reverse: empty reason -> 400', async () => {
    const c = await makeCommission();
    await expect(reverseCommission(adminA, c.id, '   ')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('reverse: mirror itself starts at PENDING and goes through its own control', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    const mirror = await reverseCommission(adminA, c.id, 'Correction');
    expect(mirror.status).toBe('PENDING');
    // The mirror can be verified and approved like any other commission.
    const v = await verifyCommission(adminA, mirror.id);
    expect(v.status).toBe('VERIFIED');
    const a = await approveCommission(adminA, mirror.id);
    expect(a.status).toBe('APPROVED');
  });

  it('reverse: reversing an APPROVED original does NOT reduce unpaid balance until the mirror is approved', async () => {
    const c = await makeCommission();
    await verifyCommission(adminA, c.id);
    await approveCommission(adminA, c.id);
    await reverseCommission(adminA, c.id, 'Correction');

    const unpaid = await Commission.find({
      agentId: new Types.ObjectId(agentId),
      status: { $in: ['PENDING', 'VERIFIED', 'APPROVED'] },
    }).lean<{ netAmount: { amount: number } }[]>();

    const total = unpaid.reduce((s, row) => s + row.netAmount.amount, 0);
    expect(unpaid).toHaveLength(2);
    expect(total).toBe(0);
  });
});
