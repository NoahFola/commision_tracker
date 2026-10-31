import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { AgentUser } from '@/models/agent-user.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { GET as getAgentRoute } from '../[id]/route';
import { makeAgentUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('GET /api/agents/[id]', () => {
  let adminSessionId: string;
  let regionId: Types.ObjectId;
  let seededAgentId: Types.ObjectId;

  beforeAll(async () => {
    await connectDb();
  });
  afterAll(async () => {
  // Intentionally do NOT disconnect — the connection is shared across
  // test files in the worker. See vitest.setup.ts.
});

  beforeEach(async () => {
    await Promise.all([
      Agent.deleteMany({}),
      AgentUser.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      Session.deleteMany({}),
    ]);
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
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
      payoutPreference: {
        method: 'MOBILE_MONEY',
        provider: 'MTN MoMo',
        accountNumber: '677000000',
        accountName: 'Awa Ngwa',
        isDefault: true,
      },
    });
    seededAgentId = agent._id as Types.ObjectId;
  });

  const req = (id: string, cookie = adminSessionId): Request =>
    new Request(`http://x/api/agents/${id}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 401 when unauthenticated', async () => {
    const res = await getAgentRoute(
      new Request(`http://x/api/agents/${String(seededAgentId)}`),
      ctx(String(seededAgentId)),
    );
    expect(res.status).toBe(401);
  });

  it('returns the full agent with payoutPreference and populated region', async () => {
    const res = await getAgentRoute(req(String(seededAgentId)), ctx(String(seededAgentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(String(seededAgentId));
    expect(body.data.email).toBe('awa@example.cm');
    expect(body.data.region).toEqual({ id: String(regionId), name: 'Douala' });
    expect(body.data.payoutPreference).toMatchObject({
      method: 'MOBILE_MONEY',
      provider: 'MTN MoMo',
      accountNumber: '677000000',
      isDefault: true,
    });
    expect(body.data.profilePictureUrl).toBeNull();
  });

  it('never returns a passwordHash field', async () => {
    const res = await getAgentRoute(req(String(seededAgentId)), ctx(String(seededAgentId)));
    const body = await res.json();
    expect(body.data).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('returns 400 for a non-ObjectId id', async () => {
    const res = await getAgentRoute(req('not-an-id'), ctx('not-an-id'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 for a valid ObjectId that matches nothing', async () => {
    const bogus = new Types.ObjectId().toHexString();
    const res = await getAgentRoute(req(bogus), ctx(bogus));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when a non-admin caller is scoped out', async () => {
    // Synthetic agent session for a *different* agent id. This exercises
    // assertCanAccessAgent before Phase 7 exists. The route's withAuth(['ADMIN'])
    // would reject it at 403 anyway for the wrong role; this test proves the
    // object-level check inside the service is independently correct.
    const otherAgent = await Agent.create({
      fullName: 'Other',
      type: 'AGENT',
      email: 'other@example.cm',
      phone: '+237600000099',
      regionId,
      referralCode: 'OTHER1',
      payoutPreference: { method: 'CASH' },
    });

    // Directly test the service, bypassing withAuth so we hit the scope check.
    const { getAgent } = await import('@/services/agent.service');
    // const fakeAgentUser = {
    //   subjectType: 'AGENT' as const,
    //   subjectId: String(otherAgent._id),
    //   email: 'other@example.cm',
    //   name: 'Other',
    //   profilePictureUrl: null,
    //   roles: ['AGENT'] as const,
    //   agentId: String(otherAgent._id),
    //   agentType: 'AGENT' as const,
    //   referralCode: 'OTHER1',
    // };

        const fakeAgentUser = makeAgentUser({
          subjectId: String(otherAgent._id),
          agentId: String(otherAgent._id),
        });
    await expect(getAgent(fakeAgentUser, String(seededAgentId))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('response shape matches the create endpoint', async () => {
    // Compare key sets with the create response shape from Step 3.3. Both
    // return AgentDetail. This is a guard against the shapes drifting.
    const res = await getAgentRoute(req(String(seededAgentId)), ctx(String(seededAgentId)));
    const body = await res.json();
    const keys = Object.keys(body.data).sort();
    expect(keys).toEqual(
      [
        'dateJoined',
        'email',
        'fullName',
        'id',
        'onboardingStage',
        'payoutPreference',
        'phone',
        'profilePictureUrl',
        'referralCode',
        'region',
        'status',
        'type',
      ].sort(),
    );
  });
});
