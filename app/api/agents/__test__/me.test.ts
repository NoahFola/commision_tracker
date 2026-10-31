import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { PATCH as patchMe } from '../me/route';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('PATCH /api/agents/me', () => {
  let agentId: string;
  let agentSessionId: string;
  let adminSessionId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    await Promise.all([
      Agent.deleteMany({}),
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
    adminSessionId = (await createSession({ type: 'ADMIN', id: admin._id })).sessionId;

    const region = await Region.create({ name: 'Douala' });
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
    agentId = String(agent._id);
    agentSessionId = (await createSession({ type: 'AGENT', id: agent._id })).sessionId;
  });

  const req = (body: unknown, cookie = agentSessionId): Request =>
    new Request('http://x/api/agents/me', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
      },
      body: JSON.stringify(body),
    });

  const ctx = { params: Promise.resolve({}) };

  it('returns 401 when unauthenticated', async () => {
    const res = await patchMe(
      new Request('http://x/api/agents/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '+237600000001' }),
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for an admin session', async () => {
    const res = await patchMe(req({ phone: '+237600000001' }, adminSessionId), ctx);
    expect(res.status).toBe(403);
  });

  it('updates phone and returns the AuthMeAgent shape', async () => {
    const res = await patchMe(req({ phone: '+237699999999' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      subjectType: 'AGENT',
      agentId,
      agentType: 'AGENT',
      roles: ['AGENT'],
    });
    expect(body.data.email).toBe('awa@example.cm');
    expect(body.data.name).toBe('Awa Ngwa');

    const stored = await Agent.findById(agentId).lean<{ phone: string }>();
    expect(stored!.phone).toBe('+237699999999');
  });

  it('updating phone writes no audit row (routine edit)', async () => {
    await patchMe(req({ phone: '+237699999999' }), ctx);
    expect(await AuditLog.countDocuments({ entityId: agentId })).toBe(0);
  });

  it('updating payoutPreference writes an audit row', async () => {
    const res = await patchMe(
      req({
        payoutPreference: {
          method: 'BANK',
          provider: 'Afriland',
          accountNumber: '1234567890',
          accountName: 'Awa Ngwa',
        },
      }),
      ctx,
    );
    expect(res.status).toBe(200);

    const audits = await AuditLog.find({ entityId: agentId });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('UPDATE');
    expect(
      (audits[0]!.diff.before as { payoutPreference: { method: string } }).payoutPreference.method,
    ).toBe('MOBILE_MONEY');
    expect(
      (audits[0]!.diff.after as { payoutPreference: { method: string } }).payoutPreference.method,
    ).toBe('BANK');
  });

  it('updating profilePictureUrl writes no audit row', async () => {
    const res = await patchMe(req({ profilePictureUrl: 'https://example.com/a.jpg' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.profilePictureUrl).toBe('https://example.com/a.jpg');
    expect(await AuditLog.countDocuments({ entityId: agentId })).toBe(0);
  });

  it('combined phone + payoutPreference writes one audit row with only the preference diff', async () => {
    await patchMe(
      req({
        phone: '+237699999999',
        payoutPreference: {
          method: 'BANK',
          accountNumber: '99',
        },
      }),
      ctx,
    );
    const audits = await AuditLog.find({ entityId: agentId });
    expect(audits).toHaveLength(1);
    const after = audits[0]!.diff.after as Record<string, unknown>;
    expect(after).toHaveProperty('payoutPreference');
    expect(after).not.toHaveProperty('phone');
  });

  it('an empty body is a no-op and writes no audit row', async () => {
    const res = await patchMe(req({}), ctx);
    expect(res.status).toBe(200);
    expect(await AuditLog.countDocuments({ entityId: agentId })).toBe(0);
  });

  it('rejects every forbidden field with 400', async () => {
    const forbidden: Record<string, unknown>[] = [
      { fullName: 'Different Name' },
      { email: 'new@example.cm' },
      { type: 'AMBASSADOR' },
      { regionId: new Types.ObjectId().toHexString() },
      { referralCode: 'NEW01' },
      { status: 'SUSPENDED' },
      { onboardingStage: 'VERIFIED' },
      { commissionRate: 800 },
      { password: 'newpassword123' },
    ];
    for (const body of forbidden) {
      const res = await patchMe(req(body), ctx);
      expect(res.status).toBe(400);
      const resBody = await res.json();
      expect(resBody.error.code).toBe('BAD_REQUEST');
    }
  });

  it('rejects a bad phone format', async () => {
    const res = await patchMe(req({ phone: 'not-a-phone' }), ctx);
    expect(res.status).toBe(400);
  });

  it('rejects a payoutPreference without method', async () => {
    const res = await patchMe(req({ payoutPreference: { provider: 'MTN MoMo' } }), ctx);
    expect(res.status).toBe(400);
  });

  it('rejects a payoutPreference with an unknown method', async () => {
    const res = await patchMe(req({ payoutPreference: { method: 'BITCOIN' } }), ctx);
    expect(res.status).toBe(400);
  });

  it('clears profilePictureUrl when sent as null', async () => {
    // Set it first.
    await Agent.updateOne({ _id: agentId }, { $set: { profilePictureUrl: 'https://x.com/a.jpg' } });
    const res = await patchMe(req({ profilePictureUrl: null }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.profilePictureUrl).toBeNull();
  });
});
