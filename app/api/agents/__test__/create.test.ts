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
import { verifyPassword } from '@/lib/auth/password';

import { POST as createAgentRoute } from '../route';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('POST /api/agents', () => {
  let sessionId: string;
  let regionId: string;

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
    const { sessionId: sid } = await createSession({ type: 'ADMIN', id: admin._id });
    sessionId = sid;
    const region = await Region.create({ name: 'Douala' });
    regionId = String(region._id);
  });

  const req = (body: unknown): Request =>
    new Request('http://x/api/agents', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      },
      body: JSON.stringify(body),
    });

  const validBody = () => ({
    fullName: 'Awa Ngwa',
    type: 'AGENT',
    email: `awa-${new Types.ObjectId().toHexString()}@example.cm`,
    phone: `+2376${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`,
    regionId,
    referralCode: `AWA-${new Types.ObjectId().toHexString().slice(0, 6)}`,
    payoutPreference: { method: 'MOBILE_MONEY', provider: 'MTN MoMo' },
    password: 'a-very-strong-password',
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await createAgentRoute(
      new Request('http://x/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(401);
  });

  it('creates Agent and AgentUser atomically, writes one CREATE audit row', async () => {
    const body = validBody();
    const res = await createAgentRoute(req(body), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.email).toBe(body.email);
    expect(json.data.region).toEqual({ id: regionId, name: 'Douala' });

    // Agent persisted.
    const agent = await Agent.findOne({ email: body.email }).lean<{ _id: Types.ObjectId }>();
    expect(agent).not.toBeNull();

    // AgentUser persisted with a verifiable hash.
    const agentUser = await AgentUser.findOne({ email: body.email }).lean<{
      agentId: Types.ObjectId;
      passwordHash: string;
    }>();
    expect(agentUser).not.toBeNull();
    expect(String(agentUser!.agentId)).toBe(String(agent!._id));
    expect(await verifyPassword(body.password, agentUser!.passwordHash)).toBe(true);

    // Exactly one audit row.
    const audits = await AuditLog.find({ entityType: 'Agent', entityId: String(agent!._id) });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('CREATE');
    const row = audits[0];
if (!row) throw new Error('expected an audit row');
expect(row.diff.before).toBeNull();
    expect(audits[0]!.diff.after).toMatchObject({ email: body.email });
  });

  it('returns 409 on duplicate email', async () => {
    const body = validBody();
    await createAgentRoute(req(body), { params: Promise.resolve({}) });

    const dup = { ...validBody(), email: body.email };
    const res = await createAgentRoute(req(dup), { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CONFLICT');
  });

  it('returns 409 on duplicate phone', async () => {
    const body = validBody();
    await createAgentRoute(req(body), { params: Promise.resolve({}) });

    const dup = { ...validBody(), phone: body.phone };
    const res = await createAgentRoute(req(dup), { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
  });

  it('returns 409 on duplicate referralCode', async () => {
    const body = validBody();
    await createAgentRoute(req(body), { params: Promise.resolve({}) });

    const dup = { ...validBody(), referralCode: body.referralCode };
    const res = await createAgentRoute(req(dup), { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
  });

  it('returns 400 when the region does not exist', async () => {
    const body = { ...validBody(), regionId: new Types.ObjectId().toHexString() };
    const res = await createAgentRoute(req(body), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the region is inactive', async () => {
    await Region.updateOne({ _id: new Types.ObjectId(regionId) }, { $set: { isActive: false } });
    const res = await createAgentRoute(req(validBody()), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 400 on validation errors', async () => {
    const bad = { ...validBody(), password: 'short' };
    const res = await createAgentRoute(req(bad), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('rolls back the Agent if AgentUser creation fails', async () => {
    // Pre-create an AgentUser with the same email but a different agentId.
    // The email collision will occur on AgentUser.create, after Agent.create
    // succeeded — the transaction must abort and the Agent must not persist.
    const email = `rollback-${new Types.ObjectId().toHexString()}@example.cm`;
    await AgentUser.create({
      agentId: new Types.ObjectId(),
      email,
      passwordHash: 'x'.repeat(60),
    });

    const body = { ...validBody(), email };
    const res = await createAgentRoute(req(body), { params: Promise.resolve({}) });

    // AgentUser duplicate → 409.
    expect(res.status).toBe(409);

    // The critical assertion: no Agent row was created.
    const agents = await Agent.find({ email });
    expect(agents).toHaveLength(0);

    // And no audit row either (the transaction aborted).
    const audits = await AuditLog.find({ 'diff.after.email': email });
    expect(audits).toHaveLength(0);
  });
});