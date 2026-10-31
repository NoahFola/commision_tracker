import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { AgentUser } from '@/models/agent-user.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { PATCH as patchAgentRoute } from '../[id]/route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('PATCH /api/agents/[id]', () => {
  let adminId: string;
  let adminSessionId: string;
  let regionId: Types.ObjectId;
  let agentId: Types.ObjectId;

  beforeAll(async () => {
    await connectDb();
  });
  afterAll(async () => {
    await disconnectDb();
  });

  beforeEach(async () => {
    // await Promise.all([
    //   Agent.deleteMany({}),
    //   AgentUser.deleteMany({}),
    //   Region.deleteMany({}),
    //   Admin.deleteMany({}),
    //   Session.deleteMany({}),
    //   AuditLog.deleteMany({}),
    // ]);
    await wipeAllCollections();

    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    adminId = String(admin._id);
    const { sessionId } = await createSession({ type: 'ADMIN', id: admin._id });
    adminSessionId = sessionId;

    const region = await Region.create({ name: 'Douala' });
    regionId = region._id;

    const agent = await Agent.create({
      fullName: 'Awa Ngwa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      status: 'ACTIVE',
      onboardingStage: 'REGISTERED',
      payoutPreference: { method: 'MOBILE_MONEY', provider: 'MTN MoMo' },
    });
    agentId = agent._id as Types.ObjectId;

    await AgentUser.create({
      agentId: agent._id,
      email: 'awa@example.cm',
      passwordHash: 'x'.repeat(60),
    });
  });

  const req = (body: unknown, cookie = adminSessionId): Request =>
    new Request(`http://x/api/agents/${String(agentId)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
      },
      body: JSON.stringify(body),
    });

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 401 when unauthenticated', async () => {
    const res = await patchAgentRoute(
      new Request(`http://x/api/agents/${String(agentId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: 'X' }),
      }),
      ctx(String(agentId)),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await patchAgentRoute(
      new Request('http://x/api/agents/not-an-id', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}`,
        },
        body: JSON.stringify({ fullName: 'X' }),
      }),
      ctx('not-an-id'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for a valid id with no document', async () => {
    const bogus = new Types.ObjectId().toHexString();
    const res = await patchAgentRoute(
      new Request(`http://x/api/agents/${bogus}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}`,
        },
        body: JSON.stringify({ fullName: 'X' }),
      }),
      ctx(bogus),
    );
    expect(res.status).toBe(404);
  });

  it('updates fullName — no audit row (routine edit)', async () => {
    const res = await patchAgentRoute(req({ fullName: 'New Name' }), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.fullName).toBe('New Name');
    expect(await AuditLog.countDocuments({ entityId: String(agentId) })).toBe(0);
  });

  it('transitions ACTIVE -> SUSPENDED, writes one UPDATE audit row', async () => {
    const res = await patchAgentRoute(req({ status: 'SUSPENDED' }), ctx(String(agentId)));
    expect(res.status).toBe(200);

    const audits = await AuditLog.find({ entityId: String(agentId) });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('UPDATE');
    expect(audits[0]!.diff.before).toEqual({ status: 'ACTIVE' });
    expect(audits[0]!.diff.after).toEqual({ status: 'SUSPENDED' });
  });

  it('advances onboardingStage one step at a time, audited', async () => {
    const res = await patchAgentRoute(
      req({ onboardingStage: 'PROFILE_COMPLETE' }),
      ctx(String(agentId)),
    );
    expect(res.status).toBe(200);
    const audits = await AuditLog.find({ entityId: String(agentId) });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.diff.after).toEqual({ onboardingStage: 'PROFILE_COMPLETE' });
  });

  it('rejects skipping an onboarding stage', async () => {
    const res = await patchAgentRoute(req({ onboardingStage: 'VERIFIED' }), ctx(String(agentId)));
    expect(res.status).toBe(400);
  });

  it('rejects going backward in onboarding', async () => {
    await patchAgentRoute(req({ onboardingStage: 'PROFILE_COMPLETE' }), ctx(String(agentId)));
    const res = await patchAgentRoute(req({ onboardingStage: 'REGISTERED' }), ctx(String(agentId)));
    expect(res.status).toBe(400);
  });

  it('rejects transitioning out of TERMINATED', async () => {
    await patchAgentRoute(req({ status: 'TERMINATED' }), ctx(String(agentId)));
    const res = await patchAgentRoute(req({ status: 'ACTIVE' }), ctx(String(agentId)));
    expect(res.status).toBe(400);
  });

  it('rejects SUSPENDED -> INACTIVE directly', async () => {
    await patchAgentRoute(req({ status: 'SUSPENDED' }), ctx(String(agentId)));
    const res = await patchAgentRoute(req({ status: 'INACTIVE' }), ctx(String(agentId)));
    expect(res.status).toBe(400);
  });

  it('no-op status change (ACTIVE -> ACTIVE) writes no audit row', async () => {
    const res = await patchAgentRoute(req({ status: 'ACTIVE' }), ctx(String(agentId)));
    expect(res.status).toBe(200);
    expect(await AuditLog.countDocuments({ entityId: String(agentId) })).toBe(0);
  });

  it('changing regionId is audited', async () => {
    const newRegion = await Region.create({ name: 'Yaoundé' });
    const res = await patchAgentRoute(
      req({ regionId: String(newRegion._id) }),
      ctx(String(agentId)),
    );
    expect(res.status).toBe(200);
    const audits = await AuditLog.find({ entityId: String(agentId) });
    expect(audits).toHaveLength(1);
    expect((audits[0]!.diff.before as Record<string, unknown>).regionId).toBe(String(regionId));
    expect((audits[0]!.diff.after as Record<string, unknown>).regionId).toBe(String(newRegion._id));
  });

  it('changing referralCode is audited', async () => {
    const res = await patchAgentRoute(req({ referralCode: 'AWA02' }), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const audits = await AuditLog.find({ entityId: String(agentId) });
    expect(audits).toHaveLength(1);
    expect((audits[0]!.diff.after as Record<string, unknown>).referralCode).toBe('AWA02');
  });

  it('email change propagates to AgentUser.email (K2a)', async () => {
    const res = await patchAgentRoute(req({ email: 'new@example.cm' }), ctx(String(agentId)));
    expect(res.status).toBe(200);

    const agent = await Agent.findById(agentId).lean<{ email: string }>();
    expect(agent!.email).toBe('new@example.cm');

    const au = await AgentUser.findOne({ agentId }).lean<{ email: string }>();
    expect(au!.email).toBe('new@example.cm');
  });

  it('multiple audited fields in one PATCH produce one audit row', async () => {
    await patchAgentRoute(
      req({ status: 'SUSPENDED', referralCode: 'AWA03', fullName: 'Ignored' }),
      ctx(String(agentId)),
    );
    const audits = await AuditLog.find({ entityId: String(agentId) });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.diff.before).toEqual({ status: 'ACTIVE', referralCode: 'AWA01' });
    expect(audits[0]!.diff.after).toEqual({ status: 'SUSPENDED', referralCode: 'AWA03' });
    expect(audits[0]!.diff.after).not.toHaveProperty('fullName');
  });

  it('returns 409 on duplicate email', async () => {
    await Agent.create({
      fullName: 'Other',
      type: 'AGENT',
      email: 'other@example.cm',
      phone: '+237600000099',
      regionId,
      referralCode: 'OTHER1',
      payoutPreference: { method: 'CASH' },
    });
    const res = await patchAgentRoute(req({ email: 'other@example.cm' }), ctx(String(agentId)));
    expect(res.status).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Termination guard vs unpaid commissions (Phase 5, Step 5.5)
  // -------------------------------------------------------------------------

  it('blocks termination when the agent has unpaid approved commissions', async () => {
    const { createCommission, verifyCommission, approveCommission } =
      await import('@/services/commission.service');

    // const adminUser = {
    //   subjectType: 'ADMIN' as const,
    //   subjectId: adminId,
    //   email: 'admin@epsihome.cm',
    //   name: 'Ops',
    //   profilePictureUrl: null,
    //   roles: ['ADMIN'],
    // };

    const adminUser = makeAdminUser();

    const c = await createCommission(adminUser, {
      agentId: String(agentId),
      coreCustomerId: 'CUST-001',
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });
    await verifyCommission(adminUser, c.id);
    await approveCommission(adminUser, c.id);

    const res = await patchAgentRoute(req({ status: 'TERMINATED' }), ctx(String(agentId)));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toMatch(/unpaid commissions/);
  });

  it('allows termination when the ledger nets to zero via a reversal', async () => {
    const { createCommission, verifyCommission, approveCommission, reverseCommission } =
      await import('@/services/commission.service');

    // const adminUser = {
    //   subjectType: 'ADMIN' as const,
    //   subjectId: adminId,
    //   email: 'admin@epsihome.cm',
    //   name: 'Ops',
    //   profilePictureUrl: null,
    //   roles: ['ADMIN'],
    // };

    const adminUser = makeAdminUser({
      subjectId: String(adminId),
    });

    const c = await createCommission(adminUser, {
      agentId: String(agentId),
      coreCustomerId: 'CUST-001',
      firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });
    await verifyCommission(adminUser, c.id);
    await approveCommission(adminUser, c.id);
    await reverseCommission(adminUser, c.id, 'Correction');

    const res = await patchAgentRoute(req({ status: 'TERMINATED' }), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('TERMINATED');
  });
});
