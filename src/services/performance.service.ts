import { writeAudit } from '@/lib/audit/write-audit';
import { assertCanAccessAgent } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/mongoose';
import { BadRequestError, ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { Money } from '@/lib/money';
import { watDayToDate, watWeekStart } from '@/lib/time';
import type {
  AggregatePerformanceQuery,
  CreatePerformanceBody,
  ListPerformanceQuery,
} from '@/lib/validation/performance';
import { Agent } from '@/models/agent.model';
import { PerformanceEvent } from '@/models/performance-event.model';
import type { Paginated } from '@/types/api';
import type { AuthMe } from '@/types/auth';
import mongoose, { Types } from 'mongoose';

/**
 * Performance-event business logic.
 *
 * Design rules (locked in Phase 4 kickoff):
 *   - Append-only. No updates, no deletes.
 *   - A correction is a new row with supersedesId + reason.
 *   - Correction CHAINS ARE ALLOWED (N2). The "current" row for a
 *     (agentId, dayKey) group is the row that no other row supersedes.
 *   - A day with no row is treated as zero activity — the ledger is
 *     sparse, not a dense daily grid (M4).
 *   - Every create and every correction is audited.
 */

export type PerformanceEventView = {
  id: string;
  agentId: string;
  dayKey: string;
  date: string;
  leadsGenerated: number;
  dealsClosed: number;
  propertiesReferred: number;
  landlordsOnboarded: number;
  tenantsOnboarded: number;
  revenueAttributed: Money;
  supersedesId: string | null;
  isCurrent: boolean;
  reason: string | null;
  createdBy: string;
  createdAt: string;
};

export type AggregateBucket = {
  periodKey: string;
  leadsGenerated: number;
  dealsClosed: number;
  propertiesReferred: number;
  landlordsOnboarded: number;
  tenantsOnboarded: number;
  revenueAttributed: { amount: number; currency: string };
  eventCount: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toView(doc: Record<string, unknown>, isCurrent: boolean): PerformanceEventView {
  const pp = doc.revenueAttributed as { amount: number; currency: string };
  return {
    id: String(doc._id),
    agentId: String(doc.agentId),
    dayKey: doc.dayKey as string,
    date: (doc.date as Date).toISOString(),
    leadsGenerated: doc.leadsGenerated as number,
    dealsClosed: doc.dealsClosed as number,
    propertiesReferred: doc.propertiesReferred as number,
    landlordsOnboarded: doc.landlordsOnboarded as number,
    tenantsOnboarded: doc.tenantsOnboarded as number,
    revenueAttributed: { amount: pp.amount, currency: pp.currency } as Money,
    supersedesId: doc.supersedesId ? String(doc.supersedesId) : null,
    isCurrent,
    reason: (doc.reason as string | undefined) ?? null,
    createdBy: String(doc.createdBy),
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}

/**
 * Given all rows for one (agentId, dayKey) group, returns the set of
 * row ids that are "current" — i.e. not pointed at by any other row
 * in the same group via supersedesId.
 *
 * Uses JS rather than an aggregation for simplicity: group sizes are
 * tiny (one row per correction, and corrections are rare).
 */
function currentIdsFromGroup(rows: { _id: unknown; supersedesId?: unknown }[]): Set<string> {
  const superseded = new Set<string>();
  for (const r of rows) {
    if (r.supersedesId) superseded.add(String(r.supersedesId));
  }
  const current = new Set<string>();
  for (const r of rows) {
    const id = String(r._id);
    if (!superseded.has(id)) current.add(id);
  }
  return current;
}

// ---------------------------------------------------------------------------
// recordEvent
// ---------------------------------------------------------------------------

export async function recordEvent(
  user: AuthMe,
  body: CreatePerformanceBody,
): Promise<PerformanceEventView> {
  await connectDb();

  // Object-level scope: an admin can record for any agent; an agent for
  // themselves only. Both end up here; scopeAgentFilter/assert handles it.
  assertCanAccessAgent(user, body.agentId);

  // Verify the agent exists — a dangling performance row would be an integrity bug.
  const agent = await Agent.findById(body.agentId).lean<{ _id: Types.ObjectId }>();
  if (!agent) throw new BadRequestError('agentId does not reference an existing agent');

  // If superseding, load the target now (outside the transaction is fine:
  // the transaction re-reads to be safe against concurrent corrections).
  let supersedeTargetId: Types.ObjectId | null = null;
  if (body.supersedesId) {
    supersedeTargetId = new Types.ObjectId(body.supersedesId);
  }

  const date = watDayToDate(body.dayKey);

  const session = await mongoose.startSession();
  try {
    let created: PerformanceEventView | null = null;

    await session.withTransaction(async () => {
      // If superseding, verify the target exists, belongs to the same
      // (agentId, dayKey) group, and has not already been superseded by
      // a row we're about to write — that's over-engineering; we simply
      // require the target to be in the same group.
      let beforeSnapshot: Record<string, unknown> | null = null;
      let auditAction: 'CREATE' | 'UPDATE' = 'CREATE';

      if (supersedeTargetId) {
        const target = await PerformanceEvent.findById(supersedeTargetId).session(session).exec();
        if (!target) throw new NotFoundError('supersedesId not found');
        if (String(target.agentId) !== body.agentId || target.dayKey !== body.dayKey) {
          throw new BadRequestError(
            'supersedesId must reference a row for the same agent and dayKey',
          );
        }
        // Overwrite guard: a row may not be superseded twice.
        const already = await PerformanceEvent.countDocuments({
          supersedesId: supersedeTargetId,
        }).session(session);
        if (already > 0) {
          throw new ConflictError('The target row has already been superseded');
        }
        beforeSnapshot = {
          _id: String(target._id),
          dayKey: target.dayKey,
          leadsGenerated: target.leadsGenerated,
          dealsClosed: target.dealsClosed,
          propertiesReferred: target.propertiesReferred,
          landlordsOnboarded: target.landlordsOnboarded,
          tenantsOnboarded: target.tenantsOnboarded,
          revenueAttributed: target.revenueAttributed,
          reason: (target.reason as string | undefined) ?? null,
        };
        auditAction = 'UPDATE';
      }

      const [doc] = await PerformanceEvent.create(
        [
          {
            agentId: new Types.ObjectId(body.agentId),
            dayKey: body.dayKey,
            date,
            leadsGenerated: body.leadsGenerated,
            dealsClosed: body.dealsClosed,
            propertiesReferred: body.propertiesReferred,
            landlordsOnboarded: body.landlordsOnboarded,
            tenantsOnboarded: body.tenantsOnboarded,
            revenueAttributed: body.revenueAttributed,
            supersedesId: supersedeTargetId,
            reason: body.reason,
            createdBy: new Types.ObjectId(user.subjectId),
          },
        ],
        { session },
      );

      if (!doc) throw new Error('PerformanceEvent.create returned no document');

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: user.subjectType === 'ADMIN' ? 'ADMIN' : 'AGENT',
        entityType: 'PerformanceEvent',
        entityId: String(doc._id),
        action: auditAction,
        before: beforeSnapshot,
        after: {
          _id: String(doc._id),
          agentId: body.agentId,
          dayKey: body.dayKey,
          leadsGenerated: body.leadsGenerated,
          dealsClosed: body.dealsClosed,
          propertiesReferred: body.propertiesReferred,
          landlordsOnboarded: body.landlordsOnboarded,
          tenantsOnboarded: body.tenantsOnboarded,
          revenueAttributed: body.revenueAttributed,
          supersedesId: body.supersedesId ?? null,
        },
        reason: body.reason,
        session,
      });

      created = toView(
        {
          _id: doc._id,
          agentId: doc.agentId,
          dayKey: doc.dayKey,
          date: doc.date,
          leadsGenerated: doc.leadsGenerated,
          dealsClosed: doc.dealsClosed,
          propertiesReferred: doc.propertiesReferred,
          landlordsOnboarded: doc.landlordsOnboarded,
          tenantsOnboarded: doc.tenantsOnboarded,
          revenueAttributed: doc.revenueAttributed,
          supersedesId: doc.supersedesId,
          reason: doc.reason,
          createdBy: doc.createdBy,
          createdAt: (doc as { createdAt?: Date }).createdAt ?? new Date(),
        },
        true,
      );
    });

    if (!created) throw new Error('Transaction completed without a created event');
    return created;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

export async function listEvents(
  user: AuthMe,
  query: ListPerformanceQuery,
): Promise<Paginated<PerformanceEventView>> {
  await connectDb();

  const base: Record<string, unknown> = {};
  if (query.agentId) base.agentId = new Types.ObjectId(query.agentId);
  base.dayKey = { $gte: query.from, $lte: query.to };

  // Scope: admin sees all, agent sees own. scopeAgentFilter narrows _id
  // when the caller is an agent — here the target field is `agentId`, so
  // we apply the scope directly to `agentId` instead of `_id`.
  if (user.subjectType === 'AGENT') {
    base.agentId = new Types.ObjectId(user.agentId);
  }

  const docs = await PerformanceEvent.find(base).sort({ dayKey: -1, createdAt: -1 }).lean().exec();

  // Compute current set per (agentId, dayKey) group.
  const groups = new Map<string, { _id: unknown; supersedesId?: unknown }[]>();
  for (const d of docs) {
    const key = `${String(d.agentId)}|${d.dayKey as string}`;
    const g = groups.get(key) ?? [];
    g.push({ _id: d._id, supersedesId: d.supersedesId });
    groups.set(key, g);
  }
  const currentIds = new Set<string>();
  for (const rows of groups.values()) {
    for (const id of currentIdsFromGroup(rows)) currentIds.add(id);
  }

  const filtered = query.onlyCurrent ? docs.filter((d) => currentIds.has(String(d._id))) : docs;

  const total = filtered.length;
  const skip = (query.page - 1) * query.limit;
  const pageItems = filtered.slice(skip, skip + query.limit);

  const items = pageItems.map((d) =>
    toView(d as unknown as Record<string, unknown>, currentIds.has(String(d._id))),
  );

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

// ---------------------------------------------------------------------------
// aggregateEvents
// ---------------------------------------------------------------------------

/**
 * Aggregates the CURRENT rows in the given range into daily, weekly, or
 * monthly buckets. Days with no rows contribute nothing — the ledger is
 * sparse (M4), so an absent day is implicitly zero.
 *
 * Only one currency is supported per bucket: if rows with different
 * currencies appear in the same bucket, we throw. Mixed-currency
 * aggregation is a business error, not something to guess about.
 */
export async function aggregateEvents(
  user: AuthMe,
  query: AggregatePerformanceQuery,
): Promise<{ granularity: string; from: string; to: string; buckets: AggregateBucket[] }> {
  await connectDb();

  const base: Record<string, unknown> = {};
  if (query.agentId) base.agentId = new Types.ObjectId(query.agentId);
  base.dayKey = { $gte: query.from, $lte: query.to };
  if (user.subjectType === 'AGENT') {
    base.agentId = new Types.ObjectId(user.agentId);
  }

  const docs = await PerformanceEvent.find(base).lean().exec();

  const groups = new Map<string, { _id: unknown; supersedesId?: unknown }[]>();
  for (const d of docs) {
    const key = `${String(d.agentId)}|${d.dayKey as string}`;
    const g = groups.get(key) ?? [];
    g.push({ _id: d._id, supersedesId: d.supersedesId });
    groups.set(key, g);
  }
  const currentIds = new Set<string>();
  for (const rows of groups.values()) {
    for (const id of currentIdsFromGroup(rows)) currentIds.add(id);
  }

  const buckets = new Map<string, AggregateBucket>();
  for (const d of docs) {
    if (!currentIds.has(String(d._id))) continue;

    const dayKey = d.dayKey as string;
    const periodKey =
      query.granularity === 'daily'
        ? dayKey
        : query.granularity === 'weekly'
          ? watWeekStart(dayKey)
          : dayKey.slice(0, 7); // 'YYYY-MM'

    const amount = (d.revenueAttributed as { amount: number }).amount;
    const currency = (d.revenueAttributed as { currency: string }).currency;

    const existing = buckets.get(periodKey);
    if (!existing) {
      buckets.set(periodKey, {
        periodKey,
        leadsGenerated: d.leadsGenerated as number,
        dealsClosed: d.dealsClosed as number,
        propertiesReferred: d.propertiesReferred as number,
        landlordsOnboarded: d.landlordsOnboarded as number,
        tenantsOnboarded: d.tenantsOnboarded as number,
        revenueAttributed: { amount, currency },
        eventCount: 1,
      });
    } else {
      if (existing.revenueAttributed.currency !== currency) {
        throw new BadRequestError(
          `Mixed currencies in bucket ${periodKey}: ${existing.revenueAttributed.currency} and ${currency}`,
        );
      }
      existing.leadsGenerated += d.leadsGenerated as number;
      existing.dealsClosed += d.dealsClosed as number;
      existing.propertiesReferred += d.propertiesReferred as number;
      existing.landlordsOnboarded += d.landlordsOnboarded as number;
      existing.tenantsOnboarded += d.tenantsOnboarded as number;
      existing.revenueAttributed.amount += amount;
      existing.eventCount += 1;
    }
  }

  const sorted = [...buckets.values()].sort((a, b) =>
    a.periodKey < b.periodKey ? -1 : a.periodKey > b.periodKey ? 1 : 0,
  );

  return {
    granularity: query.granularity,
    from: query.from,
    to: query.to,
    buckets: sorted,
  };
}
