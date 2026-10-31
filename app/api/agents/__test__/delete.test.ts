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
import { makeAdminUser, makeAgentUser } from '@/lib/auth/__test__/fixtures';

import { DELETE as deleteAgentRoute } from '../[id]/route';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('DELETE /api/agents/[id]', () => {
  let adminSessionId: string;
  let regionId: Types.ObjectId;
  let agentId: Types.ObjectId;

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
      AuditLog.deleteMany({}),
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
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    agentId = agent._id as Types.ObjectId;
    await AgentUser.create({
      agentId: agent._id,
      email: 'awa@example.cm',
      passwordHash: 'x'.repeat(60),
    });
  });

  const req = (cookie = adminSessionId): Request =>
    new Request(`http://x/api/agents/${String(agentId)}`, {
      method: 'DELETE',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 401 when unauthenticated', async () => {
    const res = await deleteAgentRoute(
      new Request(`http://x/api/agents/${String(agentId)}`, { method: 'DELETE' }),
      ctx(String(agentId)),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await deleteAgentRoute(
      new Request('http://x/api/agents/not-an-id', {
        method: 'DELETE',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}` },
      }),
      ctx('not-an-id'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for a valid id with no document', async () => {
    const bogus = new Types.ObjectId().toHexString();
    const res = await deleteAgentRoute(
      new Request(`http://x/api/agents/${bogus}`, {
        method: 'DELETE',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}` },
      }),
      ctx(bogus),
    );
    expect(res.status).toBe(404);
  });

  it('terminates the agent and writes exactly one UPDATE audit row', async () => {
    const res = await deleteAgentRoute(req(), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('TERMINATED');

    const audits = await AuditLog.find({ entityId: String(agentId) }).lean<
      { action: string; diff: { before: unknown; after: unknown } }[]
    >();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('UPDATE');
    expect(audits[0]?.diff.before).toEqual({ status: 'ACTIVE' });
    expect(audits[0]?.diff.after).toEqual({ status: 'TERMINATED' });
  });

  it('does NOT hard-delete the Agent or its AgentUser', async () => {
    await deleteAgentRoute(req(), ctx(String(agentId)));
    expect(await Agent.findById(agentId)).not.toBeNull();
    expect(await AgentUser.findOne({ agentId })).not.toBeNull();
  });

  it('is idempotent: second DELETE succeeds with no extra audit row', async () => {
    await deleteAgentRoute(req(), ctx(String(agentId)));
    const res = await deleteAgentRoute(req(), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('TERMINATED');
    expect(await AuditLog.countDocuments({ entityId: String(agentId) })).toBe(1);
  });

  it('terminates a SUSPENDED agent', async () => {
    await Agent.updateOne({ _id: agentId }, { $set: { status: 'SUSPENDED' } });
    const res = await deleteAgentRoute(req(), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('TERMINATED');
  });

  it('terminates an INACTIVE agent', async () => {
    await Agent.updateOne({ _id: agentId }, { $set: { status: 'INACTIVE' } });
    const res = await deleteAgentRoute(req(), ctx(String(agentId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('TERMINATED');
  });

  it('delegates to updateAgent: both paths produce identical DB state', async () => {
    // Build a second agent and terminate via the PATCH path.
    const other = await Agent.create({
      fullName: 'Other',
      type: 'AGENT',
      email: 'other@example.cm',
      phone: '+237600000099',
      regionId,
      referralCode: 'OTHER1',
      status: 'ACTIVE',
      payoutPreference: { method: 'CASH' },
    });

    await deleteAgentRoute(req(), ctx(String(agentId)));

    const { updateAgent } = await import('@/services/agent.service');
    const fakeAdminUser = makeAdminUser();
    await updateAgent(fakeAdminUser, String(other._id), { status: 'TERMINATED' });

    const a = await Agent.findById(agentId).lean<{ status: string }>();
    const b = await Agent.findById(other._id).lean<{ status: string }>();
    expect(a!.status).toBe(b!.status);

    const aAudits = await AuditLog.find({ entityId: String(agentId) }).lean<
      { diff: { before: unknown; after: unknown; _id?: string } }[]
    >();
    const bAudits = await AuditLog.find({ entityId: String(other._id) }).lean<
      { diff: { before: unknown; after: unknown; _id?: string } }[]
    >();

    const aDiff = aAudits[0]?.diff;
    const bDiff = bAudits[0]?.diff;
    if (!aDiff || !bDiff) throw new Error('expected audit rows');

    // Compare before and after separately. The diff also contains a
    // top-level `_id` (the audit row's own id) which is different by
    // construction — the two runs are on different agents.
    expect(aDiff.before).toEqual(bDiff.before);
    expect(aDiff.after).toEqual(bDiff.after);
  });

  it('returns 403 when a non-admin caller is scoped out (service-level)', async () => {
    const { deleteAgent } = await import('@/services/agent.service');
    const other = await Agent.create({
      fullName: 'Other2',
      type: 'AGENT',
      email: 'other2@example.cm',
      phone: '+237600000098',
      regionId,
      referralCode: 'OTHER2',
      payoutPreference: { method: 'CASH' },
    });
    const fakeAgentUser = makeAgentUser({
      subjectId: String(other._id),
      agentId: String(other._id),
    });
    await expect(deleteAgent(fakeAgentUser, String(agentId))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
