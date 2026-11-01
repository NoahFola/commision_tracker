// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import { AuditLog } from '@/models/audit-log.model';
import {
  createCommission,
  verifyCommission,
  approveCommission,
} from '@/services/commission.service';
import type { AuthMeAgent } from '@/types/auth';

const hasTestDb = Boolean(process.env.MONGODB_URI);

let mockUser: AuthMeAgent | null = null;
vi.mock('@/lib/auth/session-server', () => ({
  requireSessionUser: async () => {
    if (!mockUser) throw new Error('no user in test');
    return mockUser;
  },
  getSessionUser: async () => mockUser,
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  }),
}));

afterEach(() => cleanup());

import Home from './(agent)/page';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

describe.skipIf(!hasTestDb)('agent home page', () => {
  let user: AuthMeAgent;
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
    user = {
      subjectType: 'AGENT',
      subjectId: agentId,
      email: 'awa@example.cm',
      name: 'Awa Ngwa',
      profilePictureUrl: null,
      roles: ['AGENT'],
      agentId,
      agentType: 'AGENT',
      referralCode: 'AWA01',
    };
    mockUser = user;
  });

  // const adminUser = () => ({
  //   subjectType: 'ADMIN' as const,
  //   subjectId: new Types.ObjectId().toHexString(),
  //   email: 'admin@epsihome.cm',
  //   name: 'Ops',
  //   profilePictureUrl: null,
  //   roles: ['ADMIN'],
  // });

  const adminUser = makeAdminUser();


  it('shows zero owed for an agent with no commissions', async () => {
    const ui = await Home();
    render(ui);
    expect(screen.getByText(/You are owed/i)).toBeInTheDocument();
    expect(screen.getByText(/0 XAF/)).toBeInTheDocument();
    expect(screen.getByText(/no approved earnings yet/i)).toBeInTheDocument();
  });

  it('shows the approved total and progress toward 5,000', async () => {
    for (let i = 0; i < 3; i++) {
      const c = await createCommission(adminUser, {
        agentId,
        coreCustomerId: `CUST-${i}`,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(adminUser, c.id);
      await approveCommission(adminUser, c.id);
    }

    const ui = await Home();
    render(ui);
    expect(screen.getByText(/2,850 XAF/)).toBeInTheDocument();
    expect(screen.getByText(/2,150 XAF more until/)).toBeInTheDocument();
  });

  it('shows "ready for payout" once the threshold is met', async () => {
    for (let i = 0; i < 6; i++) {
      const c = await createCommission(adminUser, {
        agentId,
        coreCustomerId: `CUST-${i}`,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(adminUser, c.id);
      await approveCommission(adminUser, c.id);
    }

    const ui = await Home();
    render(ui);
    expect(screen.getByText(/ready for payout/i)).toBeInTheDocument();
  });
});
