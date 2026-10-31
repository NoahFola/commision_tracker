import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Commission } from '@/models/commission.model';
import { PayoutBatch } from '@/models/payout-batch.model';
import { writeAudit } from '@/lib/audit/write-audit';
import type { AuthMe } from '@/types/auth';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/errors/app-error';
import { Admin, Agent } from '@/models';
import { logger } from '@/lib/logging';

/**
 * Reporting queries. Read-only, admin-only. The service does not paginate
 * — exports are expected to include the whole filtered set. See AI4 for
 * the buffered-row threshold.
 */

const ROW_WARN_THRESHOLD = 10000;

export type CommissionExportRow = {
  id: string;
  agentId: string;
  coreCustomerId: string;
  period: string;
  status: string;
  baseAmount: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  rateApplied: number;
  createdAt: string;
  paidAt: string;
};

export type PayoutExportRow = {
  id: string;
  agentId: string;
  period: string;
  status: string;
  method: string;
  commissionCount: number;
  totalAmount: number;
  currency: string;
  paymentReference: string;
  createdAt: string;
  approvedAt: string;
  paidAt: string;
};

export type CommissionExportFilter = {
  agentId?: string;
  status?: string;
  period?: string;
};

export type PayoutExportFilter = {
  agentId?: string;
  status?: string;
  period?: string;
};

/**
 * Loads commissions for CSV export. No pagination. Bounded by the
 * filter; the caller is responsible for not asking for an unbounded set.
 */
export async function loadCommissionExportRows(
  user: AuthMe,
  filter: CommissionExportFilter,
): Promise<CommissionExportRow[]> {
  await connectDb();

  const q: Record<string, unknown> = {};
  if (filter.agentId) {
    if (!Types.ObjectId.isValid(filter.agentId)) {
      throw new Error('agentId is not a valid identifier');
    }
    q.agentId = new Types.ObjectId(filter.agentId);
  }
  if (filter.status) q.status = filter.status;
  if (filter.period) q.period = filter.period;

  // Scope: only admins can reach this service (route-enforced), but
  // defence in depth — an agent session wouldn't have a path here.
  if (user.subjectType === 'AGENT') {
    q.agentId = new Types.ObjectId(user.agentId);
  }

  const docs = await Commission.find(q)
    .sort({ createdAt: -1 })
    .limit(ROW_WARN_THRESHOLD + 1)
    .lean()
    .exec();

  if (docs.length > ROW_WARN_THRESHOLD) {
    logger.warn('commission export exceeded row threshold', {
      threshold: ROW_WARN_THRESHOLD,
      rowCount: docs.length,
    });
  }

  return docs.map((d) => {
    const base = d.baseAmount as unknown as { amount: number; currency: string };
    const gross = d.grossAmount as unknown as { amount: number; currency: string };
    const fee = d.platformFee as unknown as { amount: number; currency: string };
    const net = d.netAmount as unknown as { amount: number; currency: string };
    return {
      id: String(d._id),
      agentId: String(d.agentId),
      coreCustomerId: d.coreCustomerId as string,
      period: d.period as string,
      status: d.status as string,
      baseAmount: base.amount,
      grossAmount: gross.amount,
      platformFee: fee.amount,
      netAmount: net.amount,
      currency: base.currency,
      rateApplied: d.rateApplied as number,
      createdAt: (d.createdAt as Date).toISOString(),
      paidAt: d.paidAt ? (d.paidAt as Date).toISOString() : '',
    };
  });
}

/**
 * Same as above for payout batches.
 */
export async function loadPayoutExportRows(
  user: AuthMe,
  filter: PayoutExportFilter,
): Promise<PayoutExportRow[]> {
  await connectDb();

  const q: Record<string, unknown> = {};
  if (filter.agentId) {
    if (!Types.ObjectId.isValid(filter.agentId)) {
      throw new Error('agentId is not a valid identifier');
    }
    q.agentId = new Types.ObjectId(filter.agentId);
  }
  if (filter.status) q.status = filter.status;
  if (filter.period) q.period = filter.period;

  if (user.subjectType === 'AGENT') {
    q.agentId = new Types.ObjectId(user.agentId);
  }

  const docs = await PayoutBatch.find(q)
    .sort({ createdAt: -1 })
    .limit(ROW_WARN_THRESHOLD + 1)
    .lean()
    .exec();

  if (docs.length > ROW_WARN_THRESHOLD) {
    logger.warn('payout export exceeded row threshold', {
      threshold: ROW_WARN_THRESHOLD,
      rowCount: docs.length,
    });
  }

  return docs.map((d) => {
    const total = d.totalAmount as unknown as { amount: number; currency: string };
    return {
      id: String(d._id),
      agentId: String(d.agentId),
      period: d.period as string,
      status: d.status as string,
      method: d.method as string,
      commissionCount: (d.commissionIds as unknown[]).length,
      totalAmount: total.amount,
      currency: total.currency,
      paymentReference: (d.paymentReference as string | undefined) ?? '',
      createdAt: (d.createdAt as Date).toISOString(),
      approvedAt: d.approvedAt ? (d.approvedAt as Date).toISOString() : '',
      paidAt: d.paidAt ? (d.paidAt as Date).toISOString() : '',
    };
  });
}

/**
 * Writes an audit row for an export. Called by the export routes after
 * the CSV has been generated but before the response is returned. Not
 * transactional — an audit row is a record of an action, not a
 * mutation paired with a state change.
 */
export async function auditExport(
  user: AuthMe,
  reportName: string,
  filter: Record<string, unknown>,
  rowCount: number,
): Promise<void> {
  await writeAudit({
    actorId: new Types.ObjectId(user.subjectId),
    actorEmail: user.email,
    actorType: 'ADMIN',
    entityType: 'Report',
    entityId: reportName,
    action: 'EXPORT',
    before: null,
    after: { filter, rowCount, exportedAt: new Date().toISOString() },
    reason: `CSV export of ${reportName}`,
  });
}

export type SummaryAmounts = {
  gross: number;
  platformFee: number;
  net: number;
  currency: string;
};

export type SummaryCounts = {
  pending: number;
  verified: number;
  approved: number;
  paid: number;
};

export type SummaryRow = {
  agentId: string;
  agentName: string;
  agentType: 'AGENT' | 'AMBASSADOR';
  region: { id: string; name: string } | null;
  counts: SummaryCounts;
  amounts: {
    pending: SummaryAmounts;
    approved: SummaryAmounts;
    paid: SummaryAmounts;
  };
};

export type SummaryResult = {
  period: string;
  includeEmpty: boolean;
  rows: SummaryRow[];
  totals: {
    counts: SummaryCounts;
    amounts: {
      pending: SummaryAmounts;
      approved: SummaryAmounts;
      paid: SummaryAmounts;
    };
  };
};

const ZERO_AMOUNTS = (currency: string): SummaryAmounts => ({
  gross: 0,
  platformFee: 0,
  net: 0,
  currency,
});

/**
 * Builds the monthly summary. One row per agent for the given period
 * (or only agents with activity, if includeEmpty is false).
 *
 * Mixed-currency commissions in the same period for the same agent are
 * a data error and this throws — summing across currencies is not
 * meaningful, and a silent sum would hide a real problem.
 *
 * Agents with no commissions in the period appear with zero counts and
 * zero amounts when includeEmpty is true. This is what finance wants
 * for reconciliation: "Agent X produced nothing in September" is a fact
 * that must be visible, not absent.
 */
export async function loadSummary(
  user: AuthMe,
  period: string,
  includeEmpty: boolean,
): Promise<SummaryResult> {
  await connectDb();

  // 1. Load every agent (for the empty-row case and for name/type/region).
  //    Scoping is by role: only admins reach this service.
  if (user.subjectType !== 'ADMIN') {
    throw new Error('loadSummary is admin-only');
  }

  const agents = await Agent.find({})
    .populate<{ regionId: { _id: Types.ObjectId; name: string } | null }>({
      path: 'regionId',
      select: '_id name',
    })
    .lean()
    .exec();

  // 2. Load every commission for the period and group by agentId.
  const commissions = await Commission.find({ period })
    .lean<
      {
        _id: Types.ObjectId;
        agentId: Types.ObjectId;
        status: string;
        grossAmount: { amount: number; currency: string };
        platformFee: { amount: number; currency: string };
        netAmount: { amount: number; currency: string };
      }[]
    >()
    .exec();

  // Per-agent accumulators.
  type Acc = {
    counts: SummaryCounts;
    amounts: {
      pending: SummaryAmounts;
      approved: SummaryAmounts;
      paid: SummaryAmounts;
    };
  };

  const perAgent = new Map<string, Acc>();

  function emptyAcc(currency: string): Acc {
    return {
      counts: { pending: 0, verified: 0, approved: 0, paid: 0 },
      amounts: {
        pending: ZERO_AMOUNTS(currency),
        approved: ZERO_AMOUNTS(currency),
        paid: ZERO_AMOUNTS(currency),
      },
    };
  }

  // First pass: discover currencies and detect mixed currency per agent.
  const currenciesPerAgent = new Map<string, Set<string>>();
  for (const c of commissions) {
    const k = String(c.agentId);
    const s = currenciesPerAgent.get(k) ?? new Set<string>();
    s.add(c.netAmount.currency);
    currenciesPerAgent.set(k, s);
  }
  for (const [agentIdKey, currencies] of currenciesPerAgent.entries()) {
    if (currencies.size > 1) {
      throw new BadRequestError(
        `Agent ${agentIdKey} has commissions in multiple currencies (${[...currencies].join(
          ', ',
        )}); cannot produce a single summary row`,
      );
    }
  }

  // Second pass: accumulate.
  for (const c of commissions) {
    const k = String(c.agentId);
    const currency = c.netAmount.currency;
    const acc = perAgent.get(k) ?? emptyAcc(currency);

    const status = c.status as keyof SummaryCounts;
    if (
      status === 'pending' ||
      status === 'verified' ||
      status === 'approved' ||
      status === 'paid'
    ) {
      // uppercase keys
    }
    // Status values are uppercase; map to lowercase accumulator keys.
    const statusMap: Record<string, keyof SummaryCounts> = {
      PENDING: 'pending',
      VERIFIED: 'verified',
      APPROVED: 'approved',
      PAID: 'paid',
    };
    const slot = statusMap[c.status];
    if (!slot) {
      // REVERSED not a valid status in this model; skip unknown.
      continue;
    }
    acc.counts[slot] += 1;

    // Fold VERIFIED into "pending" for amount totals so we have three
    // buckets: pending (incl. verified), approved, paid. Rationale:
    // verified commissions are approved-in-waiting; the finance view
    // cares about "not yet approved" vs "approved but unpaid" vs "paid".
    const amountBucket: 'pending' | 'approved' | 'paid' =
      slot === 'pending' || slot === 'verified' ? 'pending' : slot;
    acc.amounts[amountBucket].gross += c.grossAmount.amount;
    acc.amounts[amountBucket].platformFee += c.platformFee.amount;
    acc.amounts[amountBucket].net += c.netAmount.amount;

    perAgent.set(k, acc);
  }

  // 3. Build rows.
  const rows: SummaryRow[] = [];
  for (const a of agents) {
    const key = String(a._id);
    const acc = perAgent.get(key);
    if (!acc && !includeEmpty) continue;

    const currency = acc?.amounts.pending.currency ?? 'XAF';
    const finalAcc = acc ?? emptyAcc(currency);

    const region = a.regionId as unknown as { _id: Types.ObjectId; name: string } | null;
    rows.push({
      agentId: key,
      agentName: a.fullName as string,
      agentType: a.type as 'AGENT' | 'AMBASSADOR',
      region: region ? { id: String(region._id), name: region.name } : null,
      counts: finalAcc.counts,
      amounts: finalAcc.amounts,
    });
  }

  // 4. Totals across all rows.
  const totalsCurrency = rows[0]?.amounts.pending.currency ?? 'XAF';
  const totals: SummaryResult['totals'] = {
    counts: { pending: 0, verified: 0, approved: 0, paid: 0 },
    amounts: {
      pending: ZERO_AMOUNTS(totalsCurrency),
      approved: ZERO_AMOUNTS(totalsCurrency),
      paid: ZERO_AMOUNTS(totalsCurrency),
    },
  };
  for (const r of rows) {
    totals.counts.pending += r.counts.pending;
    totals.counts.verified += r.counts.verified;
    totals.counts.approved += r.counts.approved;
    totals.counts.paid += r.counts.paid;
    totals.amounts.pending.gross += r.amounts.pending.gross;
    totals.amounts.pending.platformFee += r.amounts.pending.platformFee;
    totals.amounts.pending.net += r.amounts.pending.net;
    totals.amounts.approved.gross += r.amounts.approved.gross;
    totals.amounts.approved.platformFee += r.amounts.approved.platformFee;
    totals.amounts.approved.net += r.amounts.approved.net;
    totals.amounts.paid.gross += r.amounts.paid.gross;
    totals.amounts.paid.platformFee += r.amounts.paid.platformFee;
    totals.amounts.paid.net += r.amounts.paid.net;
  }

  // 5. Sort rows by agent name.
  rows.sort((a, b) => (a.agentName < b.agentName ? -1 : a.agentName > b.agentName ? 1 : 0));

  return { period, includeEmpty, rows, totals };
}

export type AgentExportRow = {
  id: string;
  fullName: string;
  type: string;
  email: string;
  phone: string;
  region: string;
  status: string;
  onboardingStage: string;
  referralCode: string;
  dateJoined: string;
  commissionRate: number;
};

export type AgentExportFilter = {
  status?: string;
  type?: string;
  regionId?: string;
  ids?: string[];
};

/**
 * Loads agents for CSV export. No pagination. Filtered by the same
 * parameters as GET /api/agents, plus an optional `ids` list to export
 * a specific selection.
 *
 * Region is exported as its name, not its id, so the CSV is useful to
 * a spreadsheet reader.
 *
 * The `ids` and other filters are combined with AND. If `ids` is
 * present but empty, the result is zero rows (the user selected
 * nothing) — no error.
 */
export async function loadAgentExportRows(
  user: AuthMe,
  filter: AgentExportFilter,
): Promise<AgentExportRow[]> {
  await connectDb();

  if (user.subjectType !== 'ADMIN') {
    throw new Error('loadAgentExportRows is admin-only');
  }

  const q: Record<string, unknown> = {};
  if (filter.status) q.status = filter.status;
  if (filter.type) q.type = filter.type;
  if (filter.regionId) q.regionId = new Types.ObjectId(filter.regionId);
  if (filter.ids) {
    if (filter.ids.length === 0) return [];
    q._id = { $in: filter.ids.map((id) => new Types.ObjectId(id)) };
  }

  const docs = await Agent.find(q)
    .sort({ fullName: 1, _id: 1 })
    .limit(ROW_WARN_THRESHOLD + 1)
    .populate<{ regionId: { _id: Types.ObjectId; name: string } | null }>({
      path: 'regionId',
      select: '_id name',
    })
    .lean()
    .exec();

  if (docs.length > ROW_WARN_THRESHOLD) {
    logger.warn('agent export exceeded row threshold', {
      threshold: ROW_WARN_THRESHOLD,
      rowCount: docs.length,
    });
  }

  return docs.map((d) => {
    const region = d.regionId as unknown as { _id: Types.ObjectId; name: string } | null;
    return {
      id: String(d._id),
      fullName: d.fullName as string,
      type: d.type as string,
      email: d.email as string,
      phone: d.phone as string,
      region: region?.name ?? '',
      status: d.status as string,
      onboardingStage: d.onboardingStage as string,
      referralCode: d.referralCode as string,
      dateJoined: (d.dateJoined as Date).toISOString(),
      commissionRate: d.commissionRate as number,
    };
  });
}

export type BatchStatusBucket = {
  count: number;
  total: Money;
};

export type BatchSummaryResult = {
  period: string | null;
  buckets: {
    DRAFT: BatchStatusBucket;
    APPROVED: BatchStatusBucket;
    PROCESSING: BatchStatusBucket;
    PAID: BatchStatusBucket;
    FAILED: BatchStatusBucket;
  };
};

const BATCH_STATUSES = ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED'] as const;

/**
 * Returns per-status counts and totals for payout batches, optionally
 * filtered by period.
 *
 * Every status is always present in the response, with count 0 and a
 * zero-amount total when no batches match. This lets the UI render a
 * fixed grid without conditional logic.
 *
 * Mixed-currency buckets are rejected with 400. Summing across
 * currencies is not meaningful, and a silent sum would hide a data
 * problem.
 */
export async function loadBatchSummary(
  user: AuthMe,
  period: string | null,
): Promise<BatchSummaryResult> {
  await connectDb();

  if (user.subjectType !== 'ADMIN') {
    throw new Error('loadBatchSummary is admin-only');
  }

  const filter: Record<string, unknown> = {};
  if (period) filter.period = period;

  const docs = await PayoutBatch.find(filter)
    .select({ status: 1, totalAmount: 1 })
    .lean<
      {
        status: string;
        totalAmount: { amount: number; currency: string };
      }[]
    >()
    .exec();

  // Accumulate per-status.
  type Acc = { count: number; amounts: number[]; currency: Currency | null };
  const accs: Record<string, Acc> = {};
  for (const s of BATCH_STATUSES) {
    accs[s] = { count: 0, amounts: [], currency: null };
  }

  for (const d of docs) {
    const acc = accs[d.status];
    if (!acc) continue; // unknown status; ignore defensively
    acc.count += 1;
    acc.amounts.push(d.totalAmount.amount);
    if (!isCurrency(d.totalAmount.currency)) {
      throw new BadRequestError(`Unknown currency in batch ${d.status}: ${d.totalAmount.currency}`);
    }
    if (acc.currency === null) {
      acc.currency = d.totalAmount.currency;
    } else if (acc.currency !== d.totalAmount.currency) {
      throw new BadRequestError(
        `Mixed currencies in status ${d.status}: ${acc.currency} and ${d.totalAmount.currency}`,
      );
    }
  }

  function toBucket(acc: Acc): BatchStatusBucket {
    const currency: Currency = acc.currency ?? 'XAF';
    const amount = acc.amounts.reduce((s, v) => s + v, 0);
    return { count: acc.count, total: { amount, currency } };
  }

  return {
    period,
    buckets: {
      DRAFT: toBucket(accs['DRAFT']!),
      APPROVED: toBucket(accs['APPROVED']!),
      PROCESSING: toBucket(accs['PROCESSING']!),
      PAID: toBucket(accs['PAID']!),
      FAILED: toBucket(accs['FAILED']!),
    },
  };
}

import { AuditLog, type AuditActorType } from '@/models/audit-log.model';
import { Currency, isCurrency, Money } from '@/lib/money';

export type OnboardingTransition = {
  stage: 'REGISTERED' | 'PROFILE_COMPLETE' | 'VERIFIED' | 'ONBOARDED';
  at: string;
  by: {
    id: string;
    name: string;
    type: AuditActorType;
  };
};

export type OnboardingHistory = {
  agentId: string;
  currentStage: 'REGISTERED' | 'PROFILE_COMPLETE' | 'VERIFIED' | 'ONBOARDED';
  transitions: OnboardingTransition[];
};

/**
 * Returns the sequence of onboarding stage transitions for one agent,
 * in chronological order. The first entry is the agent creation event
 * (stage REGISTERED).
 *
 * Admin-only. Agents can see their current stage (on their own profile)
 * but not the history of who advanced each step.
 */
export async function getOnboardingHistory(
  user: AuthMe,
  agentId: string,
): Promise<OnboardingHistory> {
  await connectDb();

  if (user.subjectType !== 'ADMIN') {
    throw new ForbiddenError('Only an admin can view onboarding history');
  }

  if (!Types.ObjectId.isValid(agentId)) {
    throw new BadRequestError('id is not a valid identifier');
  }

  const agent = await Agent.findById(agentId).lean<{
    _id: Types.ObjectId;
    onboardingStage: OnboardingTransition['stage'];
  }>();
  if (!agent) throw new NotFoundError('Agent not found');

  // Load all audit rows for this agent that represent a stage change.
  //   - CREATE rows (initial stage)
  //   - UPDATE rows where diff.after.onboardingStage is present
  const rows = await AuditLog.find({
    entityType: 'Agent',
    entityId: agentId,
    $or: [
      { action: 'CREATE' },
      {
        action: 'UPDATE',
        'diff.after.onboardingStage': { $exists: true },
      },
    ],
  })
    .sort({ at: 1 })
    .lean<
      {
        _id: Types.ObjectId;
        action: string;
        at: Date;
        actorId: Types.ObjectId;
        actorType?: AuditActorType;
        diff: {
          before: { onboardingStage?: string } | null;
          after: { onboardingStage?: string } | null;
        };
      }[]
    >()
    .exec();

  // Build the transition list. For CREATE, the after snapshot is the
  // initial stage. For UPDATE, the after snapshot is the new stage.
  // A defensive check: only include a transition if the stage actually
  // differs from the previous one.
  const transitions: {
    stage: OnboardingTransition['stage'];
    at: Date;
    actorId: Types.ObjectId;
    actorType: AuditActorType;
  }[] = [];

  let previousStage: string | null = null;
  for (const r of rows) {
    const stage =
      r.action === 'CREATE'
        ? (r.diff.after?.onboardingStage as string | undefined)
        : (r.diff.after?.onboardingStage as string | undefined);
    if (!stage) continue;
    if (stage === previousStage) continue;
    transitions.push({
      stage: stage as OnboardingTransition['stage'],
      at: r.at,
      actorId: r.actorId,
      // Default to 'ADMIN' when missing: rows written before Phase 7
      // were all admin actions, and the migration may not have run yet.
      actorType: r.actorType ?? 'ADMIN',
    });
    previousStage = stage;
  }

  // Resolve actor names in two batched queries.
  const adminIds = transitions.filter((t) => t.actorType === 'ADMIN').map((t) => t.actorId);
  const agentIds = transitions.filter((t) => t.actorType === 'AGENT').map((t) => t.actorId);

  const adminDocs =
    adminIds.length > 0
      ? await Admin.find({ _id: { $in: adminIds } })
          .select({ _id: 1, name: 1 })
          .lean<{ _id: Types.ObjectId; name: string }[]>()
      : [];
  const agentDocs =
    agentIds.length > 0
      ? await Agent.find({ _id: { $in: agentIds } })
          .select({ _id: 1, fullName: 1 })
          .lean<{ _id: Types.ObjectId; fullName: string }[]>()
      : [];

  const nameByAdminId = new Map(adminDocs.map((d) => [String(d._id), d.name]));
  const nameByAgentId = new Map(agentDocs.map((d) => [String(d._id), d.fullName]));

  const output: OnboardingHistory = {
    agentId,
    currentStage: agent.onboardingStage,
    transitions: transitions.map((t) => {
      const idStr = String(t.actorId);
      const name =
        t.actorType === 'ADMIN'
          ? (nameByAdminId.get(idStr) ?? '(unknown admin)')
          : (nameByAgentId.get(idStr) ?? '(unknown agent)');
      return {
        stage: t.stage,
        at: t.at.toISOString(),
        by: { id: idStr, name, type: t.actorType },
      };
    }),
  };

  return output;
}

export type CommissionStatusBucket = {
  count: number;
  total: Money;
};

export type CommissionStatusSummary = {
  PENDING: CommissionStatusBucket;
  VERIFIED: CommissionStatusBucket;
  APPROVED: CommissionStatusBucket;
  PAID: CommissionStatusBucket;
};

const COMMISSION_STATUSES = ['PENDING', 'VERIFIED', 'APPROVED', 'PAID'] as const;

/**
 * Returns per-status counts and net-amount totals for commissions,
 * optionally filtered by period and agent.
 *
 * Every status is always present, with count 0 and a zero-amount total
 * when no commissions match. This lets the ledger render a fixed grid
 * of four tiles without conditional logic.
 *
 * Mixed-currency buckets are rejected with 400. Summing across
 * currencies is not meaningful, and a silent sum would hide a data
 * problem.
 *
 * Reversal rows are ordinary commissions with negative amounts; they
 * are counted in whatever status they hold (usually PENDING) and their
 * negative netAmount reduces that status's total. That's the correct
 * net effect.
 */
export async function loadCommissionStatusSummary(
  user: AuthMe,
  filter: { period: string | null; agentId: string | null },
): Promise<CommissionStatusSummary> {
  await connectDb();

  if (user.subjectType !== 'ADMIN') {
    throw new Error('loadCommissionStatusSummary is admin-only');
  }

  const q: Record<string, unknown> = {};
  if (filter.period) q.period = filter.period;
  if (filter.agentId) q.agentId = new Types.ObjectId(filter.agentId);

  const docs = await Commission.find(q)
    .select({ status: 1, netAmount: 1 })
    .lean<
      {
        status: string;
        netAmount: { amount: number; currency: string };
      }[]
    >()
    .exec();

  type Acc = { count: number; amounts: number[]; currency: Currency | null };
  const accs: Record<string, Acc> = {};
  for (const s of COMMISSION_STATUSES) {
    accs[s] = { count: 0, amounts: [], currency: null };
  }

  for (const d of docs) {
    const acc = accs[d.status];
    if (!acc) continue; // unknown status; ignore defensively
    acc.count += 1;
    acc.amounts.push(d.netAmount.amount);
    if (!isCurrency(d.netAmount.currency)) {
      throw new BadRequestError(
        `Unknown currency in commission status ${d.status}: ${d.netAmount.currency}`,
      );
    }
    if (acc.currency === null) {
      acc.currency = d.netAmount.currency;
    } else if (acc.currency !== d.netAmount.currency) {
      throw new BadRequestError(
        `Mixed currencies in status ${d.status}: ${acc.currency} and ${d.netAmount.currency}`,
      );
    }
  }

  function toBucket(acc: Acc): CommissionStatusBucket {
    const currency: Currency = acc.currency ?? 'XAF';
    const amount = acc.amounts.reduce((s, v) => s + v, 0);
    return { count: acc.count, total: { amount, currency } };
  }

  return {
    PENDING: toBucket(accs['PENDING']!),
    VERIFIED: toBucket(accs['VERIFIED']!),
    APPROVED: toBucket(accs['APPROVED']!),
    PAID: toBucket(accs['PAID']!),
  };
}