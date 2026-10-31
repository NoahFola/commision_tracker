import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { AuditLog } from '@/models/audit-log.model';
import { PerformanceEvent } from '@/models/performance-event.model';
import { recordEvent, listEvents, aggregateEvents } from '../performance.service';
import type { AuthMeAdmin } from '@/types/auth';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('performance.service', () => {
  let adminUser: AuthMeAdmin;
  let agentId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    await Promise.all([
      PerformanceEvent.deleteMany({}),
      Agent.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    adminUser = {
      subjectType: 'ADMIN',
      subjectId: String(admin._id),
      email: 'admin@epsihome.cm',
      name: 'Ops',
      profilePictureUrl: null,
      roles: ['ADMIN'],
    };
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
  });

  it('records an event and writes a CREATE audit row', async () => {
    const evt = await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 5000, currency: 'XAF' },
      leadsGenerated: 3,
      dealsClosed: 1,
      propertiesReferred: 2,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
    });
    expect(evt.dayKey).toBe('2026-09-30');
    expect(evt.leadsGenerated).toBe(3);
    expect(evt.isCurrent).toBe(true);

    const audits = await AuditLog.find({ entityType: 'PerformanceEvent' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('CREATE');
  });

  it('allows correction chains and computes the current row correctly', async () => {
    const v1 = await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 1000, currency: 'XAF' },
      leadsGenerated: 1,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
    });
    const v2 = await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 1200, currency: 'XAF' },
      leadsGenerated: 1,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
      supersedesId: v1.id,
      reason: 'Corrected revenue',
    });
    const v3 = await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 1500, currency: 'XAF' },
      leadsGenerated: 2,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
      supersedesId: v2.id,
      reason: 'Corrected again',
    });

    // The latest row is current; the older two are not.
    const page = await listEvents(adminUser, {
      from: '2026-09-01',
      to: '2026-09-30',
      onlyCurrent: true,
      page: 1,
      limit: 10,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.id).toBe(v3.id);

    // Full history: all three visible.
    const all = await listEvents(adminUser, {
      from: '2026-09-01',
      to: '2026-09-30',
      onlyCurrent: false,
      page: 1,
      limit: 10,
    });
    expect(all.items).toHaveLength(3);
  });

  it('rejects a second supersede of the same parent', async () => {
    const v1 = await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 1000, currency: 'XAF' },
      leadsGenerated: 1,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
    });
    await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 1200, currency: 'XAF' },
      leadsGenerated: 1,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
      supersedesId: v1.id,
      reason: 'First correction',
    });
    await expect(
      recordEvent(adminUser, {
        agentId,
        dayKey: '2026-09-30',
        revenueAttributed: { amount: 1500, currency: 'XAF' },
        leadsGenerated: 1,
        dealsClosed: 0,
        propertiesReferred: 0,
        landlordsOnboarded: 0,
        tenantsOnboarded: 0,
        supersedesId: v1.id,
        reason: 'Conflicting second correction',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('aggregates current rows only, by day/week/month', async () => {
    await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-28', // Monday
      revenueAttributed: { amount: 1000, currency: 'XAF' },
      leadsGenerated: 1,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
    });
    await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 2000, currency: 'XAF' },
      leadsGenerated: 2,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
    });

    const daily = await aggregateEvents(adminUser, {
      from: '2026-09-01',
      to: '2026-09-30',
      granularity: 'daily',
    });
    expect(daily.buckets).toHaveLength(2);

    const weekly = await aggregateEvents(adminUser, {
      from: '2026-09-01',
      to: '2026-09-30',
      granularity: 'weekly',
    });
    // Both days are in the same Monday-starting week.
    expect(weekly.buckets).toHaveLength(1);
    expect(weekly.buckets[0]!.periodKey).toBe('2026-09-28');
    expect(weekly.buckets[0]!.revenueAttributed.amount).toBe(3000);
    expect(weekly.buckets[0]!.leadsGenerated).toBe(3);

    const monthly = await aggregateEvents(adminUser, {
      from: '2026-09-01',
      to: '2026-09-30',
      granularity: 'monthly',
    });
    expect(monthly.buckets).toHaveLength(1);
    expect(monthly.buckets[0]!.periodKey).toBe('2026-09');
  });

  it('does not roll up superseded rows into aggregates', async () => {
    const v1 = await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 1000, currency: 'XAF' },
      leadsGenerated: 1,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
    });
    await recordEvent(adminUser, {
      agentId,
      dayKey: '2026-09-30',
      revenueAttributed: { amount: 3000, currency: 'XAF' },
      leadsGenerated: 2,
      dealsClosed: 0,
      propertiesReferred: 0,
      landlordsOnboarded: 0,
      tenantsOnboarded: 0,
      supersedesId: v1.id,
      reason: 'Corrected',
    });

    const monthly = await aggregateEvents(adminUser, {
      from: '2026-09-01',
      to: '2026-09-30',
      granularity: 'monthly',
    });
    // Only the corrected row's amounts count.
    expect(monthly.buckets[0]!.revenueAttributed.amount).toBe(3000);
    expect(monthly.buckets[0]!.leadsGenerated).toBe(2);
  });
});
