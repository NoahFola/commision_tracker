import { Types } from 'mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { PerformanceEvent } from '@/models/performance-event.model';
import { createSession } from '@/lib/auth/session';

export type Phase4Fixtures = {
  adminSessionId: string;
  agentSessionId: string;
  otherAgentSessionId: string;
  agentId: string;
  otherAgentId: string;
  regionId: string;
};

/** Wipes every collection Phase 4 touches. Order matters less now that
 *  we no longer disconnect between files (see vitest.setup.ts). */
export async function wipePhase4Collections(): Promise<void> {
  await Promise.all([
    PerformanceEvent.deleteMany({}),
    Agent.deleteMany({}),
    Region.deleteMany({}),
    Admin.deleteMany({}),
    Session.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
}

/**
 * Seeds one admin and two agents with sessions. Returns the ids and
 * session cookies. Idempotent per call — wipes first.
 */
export async function setupPhase4Fixtures(): Promise<Phase4Fixtures> {
  await wipePhase4Collections();

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
  });
  const a2 = await Agent.create({
    fullName: 'Bello',
    type: 'AGENT',
    email: 'bello@example.cm',
    phone: '+237600000001',
    regionId: region._id,
    referralCode: 'BEL01',
    payoutPreference: { method: 'MOBILE_MONEY' },
  });

  const agentSessionId = (await createSession({ type: 'AGENT', id: a1._id })).sessionId;
  const otherAgentSessionId = (await createSession({ type: 'AGENT', id: a2._id })).sessionId;

  return {
    adminSessionId,
    agentSessionId,
    otherAgentSessionId,
    agentId: String(a1._id),
    otherAgentId: String(a2._id),
    regionId: String(region._id),
  };
}

/** A minimal valid POST /api/performance body. */
export function performanceBody(
  agentId: string,
  dayKey: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    agentId,
    dayKey,
    revenueAttributed: { amount: 1000, currency: 'XAF' },
    leadsGenerated: 1,
    dealsClosed: 0,
    propertiesReferred: 0,
    landlordsOnboarded: 0,
    tenantsOnboarded: 0,
    ...overrides,
  };
}
