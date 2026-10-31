import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { createAgent, updateAgent } from '@/services/agent.service';
import type { AuthMeAdmin } from '@/types/auth';

import { GET as getHistory } from '../[id]/onboarding-history/route';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('GET /api/agents/[id]/onboarding-history', () => {
  let adminUser: AuthMeAdmin;
  let adminSessionId: string;
  let agentSessionId: string;
  let regionId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    await Promise.all([
      AuditLog.deleteMany({}),
      Agent.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      Session.deleteMany({}),
    ]);
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'M.-C. Fosto',
      passwordHash: 'x'.repeat(60),
    });
    adminUser = {
      subjectType: 'ADMIN',
      subjectId: String(admin._id),
      email: 'admin@epsihome.cm',
      name: 'M.-C. Fosto',
      profilePictureUrl: null,
      roles: ['ADMIN'],
    };
    adminSessionId = (await createSession({ type: 'ADMIN', id: admin._id })).sessionId;

    const region = await Region.create({ name: 'Douala' });
    regionId = String(region._id);
  });

  const req = (agentId: string, cookie?: string): Request =>
    new Request(`http://x/api/agents/${agentId}/onboarding-history`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = (agentId: string) => ({
    params: Promise.resolve({ id: agentId }),
  });

  let seedSeq = 0;

  async function seedAgent(): Promise<string> {
    seedSeq += 1;
    const created = await createAgent(adminUser, {
      fullName: 'Awa Ngwa',
      type: 'AGENT',
      email: `awa-${seedSeq}@example.cm`, // ← unique per call
      phone: `+23760000${String(seedSeq).padStart(4, '0')}`, // unique too
      regionId,
      referralCode: `AWA${String(seedSeq).padStart(2, '0')}`, // unique too
      payoutPreference: { method: 'MOBILE_MONEY' },
      password: 'a-very-strong-password',
    });
    return created.id;
  }

  it('returns 401 unauthenticated', async () => {
    const agentId = await seedAgent();
    const res = await getHistory(req(agentId), ctx(agentId));
    expect(res.status).toBe(401);
  });

  it('returns 403 for an agent session', async () => {
    const agentId = await seedAgent();
    const agentDoc = await Agent.findById(agentId).lean<{ _id: Types.ObjectId }>();
    const agentSession = (await createSession({ type: 'AGENT', id: agentDoc!._id })).sessionId;
    const res = await getHistory(req(agentId, agentSession), ctx(agentId));
    expect(res.status).toBe(403);
  });

  it('returns the creation event when no transitions have occurred', async () => {
    const agentId = await seedAgent();
    const res = await getHistory(req(agentId, adminSessionId), ctx(agentId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.agentId).toBe(agentId);
    expect(body.data.currentStage).toBe('REGISTERED');
    expect(body.data.transitions).toHaveLength(1);
    expect(body.data.transitions[0].stage).toBe('REGISTERED');
    expect(body.data.transitions[0].by.name).toBe('M.-C. Fosto');
    expect(body.data.transitions[0].by.type).toBe('ADMIN');
  });

  it('returns transitions in chronological order as the agent advances', async () => {
    const agentId = await seedAgent();

    await updateAgent(adminUser, agentId, { onboardingStage: 'PROFILE_COMPLETE' });
    await updateAgent(adminUser, agentId, { onboardingStage: 'VERIFIED' });
    await updateAgent(adminUser, agentId, { onboardingStage: 'ONBOARDED' });

    const res = await getHistory(req(agentId, adminSessionId), ctx(agentId));
    const body = await res.json();

    const stages = body.data.transitions.map((t: { stage: string }) => t.stage);
    expect(stages).toEqual(['REGISTERED', 'PROFILE_COMPLETE', 'VERIFIED', 'ONBOARDED']);
    expect(body.data.currentStage).toBe('ONBOARDED');
  });

  it('does not include transitions for non-onboarding updates', async () => {
    const agentId = await seedAgent();
    await updateAgent(adminUser, agentId, { fullName: 'Awa N.' });
    await updateAgent(adminUser, agentId, { onboardingStage: 'PROFILE_COMPLETE' });

    const res = await getHistory(req(agentId, adminSessionId), ctx(agentId));
    const body = await res.json();
    expect(body.data.transitions.map((t: { stage: string }) => t.stage)).toEqual([
      'REGISTERED',
      'PROFILE_COMPLETE',
    ]);
  });

  it('404s on an unknown agent id', async () => {
    const bogus = new Types.ObjectId().toHexString();
    const res = await getHistory(req(bogus, adminSessionId), ctx(bogus));
    expect(res.status).toBe(404);
  });

  it('400s on a malformed agent id', async () => {
    const res = await getHistory(req('not-an-id', adminSessionId), ctx('not-an-id'));
    expect(res.status).toBe(400);
  });
});
