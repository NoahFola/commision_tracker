import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { Commission } from '@/models/commission.model';
import { createSession } from '@/lib/auth/session';

export type CommissionFixtures = {
  adminId: string;
  adminSessionId: string;
  agentId: string;
  agentSessionId: string;
  otherAgentId: string;
  otherAgentSessionId: string;
  regionId: string;
};

export async function wipeCommissionCollections(): Promise<void> {
  await Promise.all([
    Commission.deleteMany({}),
    Agent.deleteMany({}),
    Region.deleteMany({}),
    Admin.deleteMany({}),
    Session.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
}

export async function setupCommissionFixtures(): Promise<CommissionFixtures> {
  await wipeCommissionCollections();

  const admin = await Admin.create({
    email: 'admin@epsihome.cm',
    name: 'Ops',
    passwordHash: 'x'.repeat(60),
  });
  const adminSessionId = (await createSession({ type: 'ADMIN', id: admin._id })).sessionId;

  const region = await Region.create({ name: 'Douala' });

  const a1 = await Agent.create({
    fullName: 'Awa',
    type: 'AGENT',
    email: 'awa@example.cm',
    phone: '+237600000000',
    regionId: region._id,
    referralCode: 'AWA01',
    payoutPreference: { method: 'MOBILE_MONEY' },
    commissionRate: 500,
  });
  const a2 = await Agent.create({
    fullName: 'Bello',
    type: 'AGENT',
    email: 'bello@example.cm',
    phone: '+237600000001',
    regionId: region._id,
    referralCode: 'BEL01',
    payoutPreference: { method: 'MOBILE_MONEY' },
    commissionRate: 500,
  });

  const agentSessionId = (await createSession({ type: 'AGENT', id: a1._id })).sessionId;
  const otherAgentSessionId = (await createSession({ type: 'AGENT', id: a2._id })).sessionId;

  return {
    adminId: String(admin._id),
    adminSessionId,
    agentId: String(a1._id),
    agentSessionId,
    otherAgentId: String(a2._id),
    otherAgentSessionId,
    regionId: String(region._id),
  };
}

/** A minimal valid POST /api/commissions body. */
export function commissionBody(
  agentId: string,
  coreCustomerId = 'CUST-001',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    agentId,
    coreCustomerId,
    firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
    baseAmount: { amount: 20000, currency: 'XAF' },
    ...overrides,
  };
}
