import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { PerformanceEvent } from '@/models/performance-event.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { POST as createPerformance } from '../route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('POST /api/performance', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let agentId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    // await Promise.all([
    //   PerformanceEvent.deleteMany({}),
    //   Agent.deleteMany({}),
    //   Region.deleteMany({}),
    //   Admin.deleteMany({}),
    //   Session.deleteMany({}),
    //   AuditLog.deleteMany({}),
    // ]);

    await wipeAllCollections()

    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    const adminSession = await createSession({ type: 'ADMIN', id: admin._id });
    adminSessionId = adminSession.sessionId;

    const region = await Region.create({ name: 'Douala' });
    const agent = await Agent.create({
      fullName: 'Awa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      payoutPreference: { method: 'MOBILE_MONEY' },
    });
    agentId = String(agent._id);

    const agentSession = await createSession({ type: 'AGENT', id: agent._id });
    agentSessionId = agentSession.sessionId;
  });

  const req = (body: unknown, cookie = adminSessionId): Request =>
    new Request('http://x/api/performance', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
      },
      body: JSON.stringify(body),
    });

  const ctx = { params: Promise.resolve({}) };

  const validBody = () => ({
    agentId,
    dayKey: '2026-09-30',
    revenueAttributed: { amount: 5000, currency: 'XAF' },
    leadsGenerated: 3,
    dealsClosed: 1,
    propertiesReferred: 2,
    landlordsOnboarded: 0,
    tenantsOnboarded: 0,
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await createPerformance(
      new Request('http://x/api/performance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when an agent tries to record an event', async () => {
    const res = await createPerformance(req(validBody(), agentSessionId), ctx);
    expect(res.status).toBe(403);
  });

  it('returns 400 for a malformed body', async () => {
    const res = await createPerformance(
      new Request('http://x/api/performance', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminSessionId}`,
        },
        body: 'not json',
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when the agent does not exist', async () => {
    const res = await createPerformance(
      req({ ...validBody(), agentId: new Types.ObjectId().toHexString() }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('creates an event, writes a CREATE audit row, returns 201', async () => {
    const res = await createPerformance(req(validBody()), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.dayKey).toBe('2026-09-30');
    expect(body.data.leadsGenerated).toBe(3);
    expect(body.data.isCurrent).toBe(true);
    expect(body.data.supersedesId).toBeNull();

    const audits = await AuditLog.find({ entityType: 'PerformanceEvent' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('CREATE');
    const row = audits[0];
if (!row) throw new Error('expected an audit row');
expect(row.diff.before).toBeNull();
  });

  it('creates a correction, writes an UPDATE audit row with before/after', async () => {
    const first = await createPerformance(req(validBody()), ctx);
    const firstBody = await first.json();
    const firstId = firstBody.data.id as string;

    const res = await createPerformance(
      req({
        ...validBody(),
        revenueAttributed: { amount: 7500, currency: 'XAF' },
        supersedesId: firstId,
        reason: 'Corrected revenue after reconciliation',
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.supersedesId).toBe(firstId);
    expect(body.data.revenueAttributed.amount).toBe(7500);
    expect(body.data.isCurrent).toBe(true);

    const audits = await AuditLog.find({
      entityType: 'PerformanceEvent',
      action: 'UPDATE',
    });
    expect(audits).toHaveLength(1);
    expect(
      (audits[0]!.diff.before as { revenueAttributed: { amount: number } }).revenueAttributed
        .amount,
    ).toBe(5000);
    expect(
      (audits[0]!.diff.after as { revenueAttributed: { amount: number } }).revenueAttributed.amount,
    ).toBe(7500);
    expect(audits[0]!.reason).toBe('Corrected revenue after reconciliation');
  });

  it('returns 400 when supersedesId refers to a different group', async () => {
    const first = await createPerformance(req(validBody()), ctx);
    const firstBody = await first.json();
    const firstId = firstBody.data.id as string;

    // Same supersedesId but a different dayKey.
    const res = await createPerformance(
      req({
        ...validBody(),
        dayKey: '2026-10-01',
        supersedesId: firstId,
        reason: 'Wrong day',
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 on a second supersede of the same parent', async () => {
    const first = await createPerformance(req(validBody()), ctx);
    const firstId = (await first.json()).data.id as string;

    await createPerformance(
      req({ ...validBody(), supersedesId: firstId, reason: 'First correction' }),
      ctx,
    );

    const res = await createPerformance(
      req({ ...validBody(), supersedesId: firstId, reason: 'Second correction' }),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('returns 400 when supersedesId is set without a reason', async () => {
    const first = await createPerformance(req(validBody()), ctx);
    const firstId = (await first.json()).data.id as string;

    const res = await createPerformance(req({ ...validBody(), supersedesId: firstId }), ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when supersedesId points at a nonexistent row', async () => {
    const res = await createPerformance(
      req({
        ...validBody(),
        supersedesId: new Types.ObjectId().toHexString(),
        reason: 'Ghost',
      }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it('response shape matches the service view', async () => {
    const res = await createPerformance(req(validBody()), ctx);
    const body = await res.json();
    const keys = Object.keys(body.data).sort();
    expect(keys).toEqual(
      [
        'agentId',
        'createdAt',
        'createdBy',
        'date',
        'dayKey',
        'dealsClosed',
        'id',
        'isCurrent',
        'landlordsOnboarded',
        'leadsGenerated',
        'propertiesReferred',
        'reason',
        'revenueAttributed',
        'supersedesId',
        'tenantsOnboarded',
      ].sort(),
    );
  });
});
