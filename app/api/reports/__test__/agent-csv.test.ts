import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { GET as getAgentsCsv } from '../agents.csv/route';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('GET /api/reports/agents.csv', () => {
  let adminSessionId: string;
  let agentSessionId: string;
  let regionDoualaId: string;
  let regionYaoundeId: string;
  let agentAId: string;
  let agentBId: string;

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

    const douala = await Region.create({ name: 'Douala' });
    const yaounde = await Region.create({ name: 'Yaoundé' });
    regionDoualaId = String(douala._id);
    regionYaoundeId = String(yaounde._id);

    const a = await Agent.create({
      fullName: 'Awa Ngwa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: douala._id,
      referralCode: 'AWA01',
      status: 'ACTIVE',
      payoutPreference: { method: 'MOBILE_MONEY' },
      commissionRate: 500,
    });
    const b = await Agent.create({
      fullName: 'Bello Nkeng',
      type: 'AMBASSADOR',
      email: 'bello@example.cm',
      phone: '+237600000001',
      regionId: yaounde._id,
      referralCode: 'BEL01',
      status: 'SUSPENDED',
      payoutPreference: { method: 'BANK' },
      commissionRate: 800,
    });
    agentAId = String(a._id);
    agentBId = String(b._id);
    agentSessionId = (await createSession({ type: 'AGENT', id: a._id })).sessionId;
  });

  const req = (qs: string, cookie?: string): Request =>
    new Request(`http://x/api/reports/agents.csv${qs}`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  it('returns 401 unauthenticated', async () => {
    const res = await getAgentsCsv(req(''), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for an agent session', async () => {
    const res = await getAgentsCsv(req('', agentSessionId), ctx);
    expect(res.status).toBe(403);
  });

  it('returns 200 with the correct content type for an admin', async () => {
    const res = await getAgentsCsv(req('', adminSessionId), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('.csv');
  });

  it('header row matches the documented column order', async () => {
    const res = await getAgentsCsv(req('', adminSessionId), ctx);
    const text = await res.text();
    const [headerLine] = text.split('\r\n');
    expect(headerLine).toBe(
      'id,fullName,type,email,phone,region,status,onboardingStage,referralCode,dateJoined,commissionRate',
    );
  });

  it('exports all agents sorted by name, with region as name', async () => {
    const res = await getAgentsCsv(req('', adminSessionId), ctx);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2
    expect(lines[1]).toContain('Awa Ngwa');
    expect(lines[1]).toContain('Douala'); // region name, not id
    expect(lines[2]).toContain('Bello Nkeng');
    expect(lines[2]).toContain('Yaoundé');
  });

  it('filters by status', async () => {
    const res = await getAgentsCsv(req('?status=SUSPENDED', adminSessionId), ctx);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2); // header + 1
    expect(lines[1]).toContain('Bello Nkeng');
  });

  it('filters by type', async () => {
    const res = await getAgentsCsv(req('?type=AMBASSADOR', adminSessionId), ctx);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Bello Nkeng');
  });

  it('filters by regionId', async () => {
    const res = await getAgentsCsv(req(`?regionId=${regionDoualaId}`, adminSessionId), ctx);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Awa Ngwa');
  });

  it('limits to a specific selection via ids (repeated params)', async () => {
    const res = await getAgentsCsv(req(`?ids=${agentBId}`, adminSessionId), ctx);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Bello Nkeng');
  });

  it('limits to a specific selection via ids (comma-separated)', async () => {
    const res = await getAgentsCsv(req(`?ids=${agentAId},${agentBId}`, adminSessionId), ctx);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
  });

  it('returns zero rows (no error) for an empty ids list', async () => {
    const res = await getAgentsCsv(req('?ids=', adminSessionId), ctx);
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(1); // header only
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await getAgentsCsv(req('?status=BOGUS', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed id in ids with 400', async () => {
    const res = await getAgentsCsv(req('?ids=not-an-id', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('writes an EXPORT audit row with the filter and row count', async () => {
    await getAgentsCsv(req('?status=ACTIVE', adminSessionId), ctx);
    const audits = await AuditLog.find({ action: 'EXPORT' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.entityId).toBe('agents.csv');
    const after = audits[0]!.diff.after as {
      rowCount: number;
      filter: { status: string | null };
    };
    expect(after.rowCount).toBe(1);
    expect(after.filter.status).toBe('ACTIVE');
  });
});
