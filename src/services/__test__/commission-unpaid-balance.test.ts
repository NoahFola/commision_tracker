import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Commission } from '@/models/commission.model';
import {
  createCommission,
  verifyCommission,
  approveCommission,
  reverseCommission,
  getUnpaidBalance,
} from '../commission.service';
import type { AuthMeAdmin } from '@/types/auth';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('getUnpaidBalance', () => {
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
      commissionRate: 500,
    });
    agentId = String(agent._id);
  });

  const make = (cust: string, amount = 20000) =>
    createCommission(adminUser, {
      agentId,
      coreCustomerId: cust,
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount, currency: 'XAF' },
    });

  it('returns zero for an agent with no commissions', async () => {
    const b = await getUnpaidBalance(agentId);
    expect(b.total).toBe(0);
    expect(b.count).toBe(0);
    expect(b.currency).toBeNull();
  });

  it('sums PENDING rows', async () => {
    await make('C-1', 20000);
    const b = await getUnpaidBalance(agentId);
    expect(b.total).toBe(950); // 5% of 20000 = 1000 gross, 5% fee = 50, net 950.
    expect(b.count).toBe(1);
    expect(b.currency).toBe('XAF');
  });

  it('sums across multiple unpaid rows', async () => {
    await make('C-1', 20000);
    await make('C-2', 40000);
    const b = await getUnpaidBalance(agentId);
    expect(b.total).toBe(950 + 1900);
    expect(b.count).toBe(2);
  });

  it('excludes PAID rows', async () => {
    const c = await make('C-1', 20000);
    await verifyCommission(adminUser, c.id);
    await approveCommission(adminUser, c.id);
    await Commission.updateOne({ _id: c.id }, { $set: { status: 'PAID' } });

    const b = await getUnpaidBalance(agentId);
    expect(b.total).toBe(0);
    expect(b.count).toBe(0);
  });

  it('sums a reversed pair to zero', async () => {
    const c = await make('C-1', 20000);
    await verifyCommission(adminUser, c.id);
    await approveCommission(adminUser, c.id);
    await reverseCommission(adminUser, c.id, 'Correction');

    const b = await getUnpaidBalance(agentId);
    // Two rows: +950 and -950.
    expect(b.total).toBe(0);
    expect(b.count).toBe(2);
  });

  it('rejects mixed currencies', async () => {
    await make('C-1', 20000); // XAF
    await createCommission(adminUser, {
      agentId,
      coreCustomerId: 'C-2',
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 100, currency: 'USD' },
    });

    await expect(getUnpaidBalance(agentId)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
