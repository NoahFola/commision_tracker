import { writeAudit } from '@/lib/audit/write-audit';
import { assertCanAccessAgent } from '@/lib/auth/guards';
import { PLATFORM_FEE_RATE_BP } from '@/lib/config/commission';
import { connectDb } from '@/lib/db/mongoose';
import { BadRequestError, ConflictError, NotFoundError } from '@/lib/errors/app-error';
import type { Money } from '@/lib/money';
import { watPeriod } from '@/lib/time';
import type { CreateCommissionBody } from '@/lib/validation/commission';
import { Agent } from '@/models/agent.model';
import type { AuditAction } from '@/models/audit-log.model';
import { Commission, type CommissionStatus } from '@/models/commission.model';
import type { AuthMe } from '@/types/auth';
import mongoose, { Types } from 'mongoose';

// Pure commission math now lives in @/lib/money/commission-math so the
// client-side New commission form can preview gross/fee/net without
// pulling Mongoose into the browser bundle. Re-exported here for every
// existing call site.
import { computeCommissionAmounts, negateAmounts } from '@/lib/money/commission-math';

// Pure commission math now lives in @/lib/money/commission-math so the
// client-side New commission form can preview gross/fee/net without
// pulling Mongoose into the browser bundle. Re-exported here for every
// existing call site.
export { computeCommissionAmounts, negateAmounts } from '@/lib/money/commission-math';
export type { CommissionAmounts } from '@/lib/money/commission-math';

// ---------------------------------------------------------------------------
// Amount calculation — moved to @/lib/money/commission-math so it can be
// imported by the client-side New commission form without pulling Mongoose
// into the browser bundle. Re-exported at the top of this file for every
// existing call site.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// State machine (pure)
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<CommissionStatus, readonly CommissionStatus[]> = {
  PENDING: ['VERIFIED'],
  VERIFIED: ['APPROVED'],
  APPROVED: ['PAID'],
  PAID: [], // terminal in Phase 5
};

/**
 * Throws BadRequestError if `from -> to` is not allowed.
 * Self-transitions are NOT allowed — every transition is a real move.
 */
export function assertValidCommissionTransition(
  from: CommissionStatus,
  to: CommissionStatus,
): void {
  if (from === to) {
    throw new BadRequestError(`Commission is already ${from}`);
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestError(`Cannot transition commission from ${from} to ${to}`);
  }
}

/**
 * Returns the next status in the lifecycle, or throws if there is none.
 * Used by the API to advance a commission by one step.
 */
export function nextCommissionStatus(from: CommissionStatus): CommissionStatus {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (allowed.length === 0) {
    throw new BadRequestError(`Commission in status ${from} has no next step`);
  }
  return allowed[0] as CommissionStatus;
}

/**
 * Can a reversal be created for a commission currently in `status`?
 * Per Phase 5 rules: yes, from any non-PAID status. A PAID commission's
 * reversal is a Phase 6 clawback, not a Phase 5 mirror.
 */
export function canReverseCommission(status: CommissionStatus): boolean {
  return status !== 'PAID';
}

// ---------------------------------------------------------------------------
// View type
// ---------------------------------------------------------------------------

export type CommissionView = {
  id: string;
  agentId: string;
  coreCustomerId: string;
  firstPaymentConfirmedAt: string; // ISO
  period: string; // 'YYYY-MM' in WAT
  baseAmount: Money;
  rateApplied: number; // basis points
  platformFeeRateApplied: number; // basis points
  grossAmount: Money;
  platformFee: Money;
  netAmount: Money;
  status: CommissionStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  paidBy: string | null;
  paidAt: string | null;
  payoutBatchId: string | null;
  reversesCommissionId: string | null;
  reason: string | null;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

function toCommissionView(doc: Record<string, unknown>): CommissionView {
  const asIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : null);
  const asId = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  return {
    id: String(doc._id),
    agentId: String(doc.agentId),
    coreCustomerId: doc.coreCustomerId as string,
    firstPaymentConfirmedAt: (doc.firstPaymentConfirmedAt as Date).toISOString(),
    period: doc.period as string,
    baseAmount: doc.baseAmount as Money,
    rateApplied: doc.rateApplied as number,
    platformFeeRateApplied: doc.platformFeeRateApplied as number,
    grossAmount: doc.grossAmount as Money,
    platformFee: doc.platformFee as Money,
    netAmount: doc.netAmount as Money,
    status: doc.status as CommissionStatus,
    verifiedBy: asId(doc.verifiedBy),
    verifiedAt: asIso(doc.verifiedAt),
    approvedBy: asId(doc.approvedBy),
    approvedAt: asIso(doc.approvedAt),
    paidBy: asId(doc.paidBy),
    paidAt: asIso(doc.paidAt),
    payoutBatchId: asId(doc.payoutBatchId),
    reversesCommissionId: asId(doc.reversesCommissionId),
    reason: (doc.reason as string | undefined) ?? null,
    createdBy: String(doc.createdBy),
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// createCommission
// ---------------------------------------------------------------------------

/**
 * Creates a commission for a signed customer whose first subscription
 * payment has been confirmed.
 *
 * Steps:
 *   1. Verify the agent exists and is not TERMINATED.
 *   2. Derive `period` from firstPaymentConfirmedAt using WAT.
 *   3. Compute gross / fee / net via computeCommissionAmounts.
 *   4. Insert the commission (status PENDING) + an AuditLog row,
 *      atomically, inside a MongoDB transaction.
 *
 * Idempotency: enforced by the partial unique index on
 * (agentId, coreCustomerId, period) for non-reversal rows. A duplicate
 * create surfaces as 409 Conflict — never a second row.
 *
 * The agent's commissionRate is read at creation and snapshotted onto
 * the row (rateApplied). Later changes to the agent's rate never touch
 * existing commissions. See C-T3.
 */
export async function createCommission(
  user: AuthMe,
  body: CreateCommissionBody,
): Promise<CommissionView> {
  await connectDb();

  // Object-level scope: an admin can create for any agent; an agent
  // for themselves only. Agents cannot create commissions (route-level),
  // but the check is here for defence in depth.
  assertCanAccessAgent(user, body.agentId);

  const agent = await Agent.findById(body.agentId).lean<{
    _id: Types.ObjectId;
    status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';
    commissionRate: number;
  }>();
  if (!agent) {
    throw new BadRequestError('agentId does not reference an existing agent');
  }
  if (agent.status === 'TERMINATED') {
    throw new BadRequestError('Cannot create a commission for a TERMINATED agent');
  }

  const firstPaymentAt = new Date(body.firstPaymentConfirmedAt);
  const period = watPeriod(firstPaymentAt);

  const amounts = computeCommissionAmounts(
    body.baseAmount,
    agent.commissionRate,
    PLATFORM_FEE_RATE_BP,
  );

  const session = await mongoose.startSession();
  try {
    let created: CommissionView | null = null;

    await session.withTransaction(async () => {
      const [doc] = await Commission.create(
        [
          {
            agentId: new Types.ObjectId(body.agentId),
            coreCustomerId: body.coreCustomerId,
            firstPaymentConfirmedAt: firstPaymentAt,
            period,
            baseAmount: body.baseAmount,
            rateApplied: agent.commissionRate,
            platformFeeRateApplied: PLATFORM_FEE_RATE_BP,
            grossAmount: amounts.grossAmount,
            platformFee: amounts.platformFee,
            netAmount: amounts.netAmount,
            status: 'PENDING',
            reversesCommissionId: null,
            createdBy: new Types.ObjectId(user.subjectId),
          },
        ],
        { session },
      );
      if (!doc) throw new Error('Commission.create returned no document');

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: 'ADMIN',
        entityType: 'Commission',
        entityId: String(doc._id),
        action: 'CREATE',
        before: null,
        after: {
          _id: String(doc._id),
          agentId: body.agentId,
          coreCustomerId: body.coreCustomerId,
          firstPaymentConfirmedAt: body.firstPaymentConfirmedAt,
          period,
          baseAmount: body.baseAmount,
          rateApplied: agent.commissionRate,
          platformFeeRateApplied: PLATFORM_FEE_RATE_BP,
          grossAmount: amounts.grossAmount,
          platformFee: amounts.platformFee,
          netAmount: amounts.netAmount,
          status: 'PENDING',
        },
        session,
      });

      created = toCommissionView(doc.toObject() as Record<string, unknown>);
    });

    if (!created) throw new Error('Transaction completed without a created commission');
    return created;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError('A commission already exists for this agent, customer, and period');
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/** Narrow a MongoDB duplicate-key error (code 11000) without using `any`. */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

// ---------------------------------------------------------------------------
// Transition helpers
// ---------------------------------------------------------------------------

type TransitionAudit = {
  action: AuditAction;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason?: string;
};

/**
 * Loads a commission for a state transition, verifies the caller may
 * act on the agent, and returns the hydrated document.
 *
 * MUST be called inside a transaction session — the caller passes the
 * session, and this helper uses it for the find.
 *
 * Throws NotFoundError if the id is not a valid commission.
 * Throws ForbiddenError via assertCanAccessAgent if the caller is
 * scoped out (agent-level scope).
 */
async function loadCommissionForTransition(
  user: AuthMe,
  id: string,
  session: mongoose.ClientSession,
) {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestError('id is not a valid identifier');
  }
  const doc = await Commission.findById(id).session(session).exec();
  if (!doc) throw new NotFoundError('Commission not found');
  // Object-level scope: admins pass, agents would fail unless the
  // commission belongs to them. Agents cannot reach these transitions
  // today (routes are ADMIN-only) but the check is defence in depth.
  assertCanAccessAgent(user, String(doc.agentId));
  return doc;
}

/**
 * Runs a state transition inside its own transaction:
 * load -> validate -> save -> audit.
 */
async function runTransition(
  user: AuthMe,
  id: string,
  apply: (doc: Awaited<ReturnType<typeof loadCommissionForTransition>>) => TransitionAudit,
): Promise<CommissionView> {
  await connectDb();

  const session = await mongoose.startSession();
  try {
    let result: CommissionView | null = null;

    await session.withTransaction(async () => {
      const doc = await loadCommissionForTransition(user, id, session);
      const audit = apply(doc);
      await doc.save({ session });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: 'ADMIN',
        entityType: 'Commission',
        entityId: String(doc._id),
        action: audit.action,
        before: audit.before,
        after: audit.after,
        reason: audit.reason,
        session,
      });

      result = toCommissionView(doc.toObject() as Record<string, unknown>);
    });

    if (!result) throw new Error('Transaction completed without a result');
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------
// verifyCommission
// ---------------------------------------------------------------------------

/**
 * PENDING -> VERIFIED. Records the verifying admin and timestamp.
 * A verification is one half of the dual-control flow; approval is the
 * other (see approveCommission). The same admin may perform both steps;
 * each is recorded separately.
 */
export async function verifyCommission(user: AuthMe, id: string): Promise<CommissionView> {
  return runTransition(user, id, (doc) => {
    const before = { status: doc.status };
    assertValidCommissionTransition(doc.status as CommissionStatus, 'VERIFIED');
    doc.status = 'VERIFIED';
    doc.verifiedBy = new Types.ObjectId(user.subjectId);
    doc.verifiedAt = new Date();
    return {
      action: 'VERIFY',
      before,
      after: {
        status: 'VERIFIED',
        verifiedBy: user.subjectId,
        verifiedAt: doc.verifiedAt.toISOString(),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// approveCommission
// ---------------------------------------------------------------------------

/**
 * VERIFIED -> APPROVED. Records the approving admin and timestamp.
 * Only runs from VERIFIED — approval cannot skip verification.
 */
export async function approveCommission(user: AuthMe, id: string): Promise<CommissionView> {
  return runTransition(user, id, (doc) => {
    const before = { status: doc.status };
    assertValidCommissionTransition(doc.status as CommissionStatus, 'APPROVED');
    doc.status = 'APPROVED';
    doc.approvedBy = new Types.ObjectId(user.subjectId);
    doc.approvedAt = new Date();
    return {
      action: 'APPROVE',
      before,
      after: {
        status: 'APPROVED',
        approvedBy: user.subjectId,
        approvedAt: doc.approvedAt.toISOString(),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// reverseCommission
// ---------------------------------------------------------------------------

/**
 * Creates a MIRROR commission that undoes `id`. The original is NOT
 * modified — its status, amounts, and lifecycle actors are unchanged.
 * The mirror is a NEW commission row with:
 *   - negative baseAmount/grossAmount/platformFee/netAmount
 *     (same currency as the original),
 *   - the same agentId, coreCustomerId, period,
 *   - reversesCommissionId = original._id,
 *   - reason = the reversal reason,
 *   - status = PENDING (the mirror goes through its own VERIFIED /
 *     APPROVED control before it can be paid).
 *
 * Rules:
 *   - Only non-PAID commissions can be reversed (canReverseCommission).
 *     Post-payment corrections are a Phase 6 clawback, not a reversal.
 *   - A reversal cannot itself be reversed (V1).
 *   - Idempotency: at most one reversal per (agent, customer, period),
 *     enforced by the partial unique index.
 *
 * NOTE: reversing an APPROVED commission does NOT immediately reduce
 * the agent's unpaid balance. The original is still APPROVED; the
 * mirror is PENDING. Both count as unpaid until the mirror reaches
 * APPROVED. This is deliberate — the mirror must go through the same
 * control as any other commission.
 */
export async function reverseCommission(
  user: AuthMe,
  id: string,
  reason: string,
): Promise<CommissionView> {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new BadRequestError('reason is required');
  }
  await connectDb();

  const session = await mongoose.startSession();
  try {
    let created: CommissionView | null = null;

    await session.withTransaction(async () => {
      const original = await loadCommissionForTransition(user, id, session);

      if (original.reversesCommissionId) {
        throw new BadRequestError('A reversal cannot itself be reversed');
      }
      if (!canReverseCommission(original.status as CommissionStatus)) {
        throw new BadRequestError(`Cannot reverse a commission in status ${original.status}`);
      }

      const negated = negateAmounts({
        grossAmount: original.grossAmount as unknown as Money,
        platformFee: original.platformFee as unknown as Money,
        netAmount: original.netAmount as unknown as Money,
      });
      const negatedBase: Money = {
        amount: -(original.baseAmount as unknown as Money).amount,
        currency: (original.baseAmount as unknown as Money).currency,
      };

      const [mirror] = await Commission.create(
        [
          {
            agentId: original.agentId,
            coreCustomerId: original.coreCustomerId,
            firstPaymentConfirmedAt: original.firstPaymentConfirmedAt,
            period: original.period,
            baseAmount: negatedBase,
            rateApplied: original.rateApplied,
            platformFeeRateApplied: original.platformFeeRateApplied,
            grossAmount: negated.grossAmount,
            platformFee: negated.platformFee,
            netAmount: negated.netAmount,
            status: 'PENDING',
            reversesCommissionId: original._id,
            reason: reason.trim(),
            createdBy: new Types.ObjectId(user.subjectId),
          },
        ],
        { session },
      );
      if (!mirror) throw new Error('Commission.create returned no document');

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: 'ADMIN',
        entityType: 'Commission',
        entityId: String(mirror._id),
        action: 'REVERSE',
        before: {
          _id: String(original._id),
          status: original.status,
          grossAmount: original.grossAmount,
          netAmount: original.netAmount,
        },
        after: {
          _id: String(mirror._id),
          reversesCommissionId: String(original._id),
          status: 'PENDING',
          grossAmount: negated.grossAmount,
          netAmount: negated.netAmount,
        },
        reason: reason.trim(),
        session,
      });

      created = toCommissionView(mirror.toObject() as Record<string, unknown>);
    });

    if (!created) throw new Error('Transaction completed without a created reversal');
    return created;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(
        'A reversal already exists for this commission’s (agent, customer, period)',
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Paginated list of commissions, scoped to the caller.
 * Admin: all agents, filterable by ?agentId=. Agent: their own rows only;
 * a mismatched ?agentId= is silently narrowed (consistent with listEvents).
 *
 * Sort: createdAt desc (newest first). Filterable by status and period.
 */
export async function listCommissions(
  user: AuthMe,
  query: import('@/lib/validation/commission').ListCommissionsQuery,
): Promise<import('@/types/api').Paginated<CommissionView>> {
  await connectDb();

  const filter: Record<string, unknown> = {};
  if (query.agentId) filter.agentId = new Types.ObjectId(query.agentId);
  if (query.status) filter.status = query.status;
  if (query.period) filter.period = query.period;

  // Scope: an agent only ever sees their own commissions.
  if (user.subjectType === 'AGENT') {
    filter.agentId = new Types.ObjectId(user.agentId);
  }

  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    Commission.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    Commission.countDocuments(filter),
  ]);

  const items = docs.map((d) => toCommissionView(d as unknown as Record<string, unknown>));

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

/**
 * Single commission. Applies object-level scope:
 *   - Admin: always allowed.
 *   - Agent: only if the commission belongs to them (else 403).
 * Returns 404 for a well-formed id with no matching document.
 */
export async function getCommission(user: AuthMe, id: string): Promise<CommissionView> {
  await connectDb();

  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestError('id is not a valid identifier');
  }

  const doc = await Commission.findById(id).lean().exec();
  if (!doc) throw new NotFoundError('Commission not found');

  assertCanAccessAgent(user, String(doc.agentId));
  return toCommissionView(doc as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Unpaid balance
// ---------------------------------------------------------------------------

export type UnpaidBalance = {
  /** Sum of netAmount.amount over PENDING | VERIFIED | APPROVED rows. */
  total: number;
  /** Currency of `total`. Undefined only when count === 0 and no rows exist. */
  currency: string | null;
  /** Number of unpaid rows. Not the thing we gate on — that's `total`. */
  count: number;
};

/**
 * Sum of netAmount over unpaid commissions for an agent.
 *
 * "Unpaid" = status in { PENDING, VERIFIED, APPROVED }.
 * PAID rows are settled. Reversal rows are ordinary unpaid rows with
 * negative amounts, so a reversed-and-uncorrected pair nets to zero.
 *
 * If the agent has unpaid commissions in more than one currency, this
 * throws — summing across currencies is not meaningful, and a silent
 * sum would hide a data-integrity problem.
 *
 * If `session` is provided, the query runs on that session (used by the
 * terminate guard inside a transaction).
 */
export async function getUnpaidBalance(
  agentId: Types.ObjectId | string,
  session?: mongoose.ClientSession,
): Promise<UnpaidBalance> {
  await connectDb();

  const agentObjectId = typeof agentId === 'string' ? new Types.ObjectId(agentId) : agentId;

  const query = Commission.find({
    agentId: agentObjectId,
    status: { $in: ['PENDING', 'VERIFIED', 'APPROVED'] },
  })
    .select({ netAmount: 1 })
    .lean<{ netAmount: { amount: number; currency: string } }[]>();

  if (session) query.session(session);

  const rows = await query.exec();

  if (rows.length === 0) {
    return { total: 0, currency: null, count: 0 };
  }

  const currencies = new Set(rows.map((r) => r.netAmount.currency));
  if (currencies.size > 1) {
    throw new BadRequestError(
      `Agent has unpaid commissions in multiple currencies: ${[...currencies].join(', ')}`,
    );
  }

  const total = rows.reduce((sum, r) => sum + r.netAmount.amount, 0);
  return { total, currency: [...currencies][0] ?? null, count: rows.length };
}
