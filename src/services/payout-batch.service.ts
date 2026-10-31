import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import {
  PayoutBatch,
  type PayoutBatchStatus,
  type PayoutMethod,
} from '@/models/payout-batch.model';
import { Commission } from '@/models/commission.model';
import { Agent } from '@/models/agent.model';
import { assertCanAccessAgent } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit/write-audit';
import { BadRequestError, ConflictError, NotFoundError } from '@/lib/errors/app-error';
import type { Money } from '@/lib/money';
import type { AuthMe } from '@/types/auth';
import type { Paginated } from '@/types/api';
import type {
  CreateBatchBody,
  ListBatchesQuery,
  MarkPaidBody,
} from '@/lib/validation/payout-batch';
import { logger } from '@/lib/logging';

// ===========================================================================
// Pure helpers (from Step 6.1 — unchanged)
// ===========================================================================

const ALLOWED_TRANSITIONS: Record<PayoutBatchStatus, readonly PayoutBatchStatus[]> = {
  DRAFT: ['APPROVED', 'FAILED'],
  APPROVED: ['PROCESSING', 'PAID', 'FAILED'],
  PROCESSING: ['PAID', 'FAILED'],
  PAID: [],
  FAILED: [],
};

export function assertValidBatchTransition(from: PayoutBatchStatus, to: PayoutBatchStatus): void {
  if (from === to) {
    throw new BadRequestError(`Batch is already ${from}`);
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new BadRequestError(`Cannot transition batch from ${from} to ${to}`);
  }
}

export function isTerminalBatchStatus(status: PayoutBatchStatus): boolean {
  return status === 'PAID' || status === 'FAILED';
}

export function isBatchEditable(status: PayoutBatchStatus): boolean {
  return status === 'DRAFT';
}

export function sumCommissionNetAmounts(commissions: { netAmount: Money }[]): Money {
  if (commissions.length === 0) {
    return { amount: 0, currency: 'XAF' };
  }
  const first = commissions[0]!.netAmount;
  for (const c of commissions) {
    if (c.netAmount.currency !== first.currency) {
      throw new BadRequestError(
        `Cannot sum commissions in mixed currencies: ${first.currency} and ${c.netAmount.currency}`,
      );
    }
  }
  const total = commissions.reduce((sum, c) => sum + c.netAmount.amount, 0);
  return { amount: total, currency: first.currency };
}

export const MINIMUM_BATCH_AMOUNT_XAF = 5000;

export function assertMeetsMinimumBatchAmount(total: Money): void {
  if (total.currency !== 'XAF') {
    throw new BadRequestError(`Minimum batch amount is defined in XAF; got ${total.currency}`);
  }
  if (total.amount < MINIMUM_BATCH_AMOUNT_XAF) {
    throw new BadRequestError(
      `Batch total ${total.amount} ${total.currency} is below the minimum of ${MINIMUM_BATCH_AMOUNT_XAF} XAF`,
    );
  }
}

// ===========================================================================
// View type
// ===========================================================================

export type PayoutBatchView = {
  id: string;
  agentId: string;
  period: string;
  commissionIds: string[];
  totalAmount: Money;
  status: PayoutBatchStatus;
  method: PayoutMethod;
  paymentReference: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  paidBy: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function toBatchView(doc: Record<string, unknown>): PayoutBatchView {
  const asIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : null);
  const asId = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  return {
    id: String(doc._id),
    agentId: String(doc.agentId),
    period: doc.period as string,
    commissionIds: ((doc.commissionIds as unknown[]) ?? []).map((id) => String(id)),
    totalAmount: doc.totalAmount as Money,
    status: doc.status as PayoutBatchStatus,
    method: doc.method as PayoutMethod,
    paymentReference: (doc.paymentReference as string | undefined) ?? null,
    createdBy: String(doc.createdBy),
    approvedBy: asId(doc.approvedBy),
    approvedAt: asIso(doc.approvedAt),
    paidBy: asId(doc.paidBy),
    paidAt: asIso(doc.paidAt),
    failedAt: asIso(doc.failedAt),
    failureReason: (doc.failureReason as string | undefined) ?? null,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}

// ===========================================================================
// Internal helpers
// ===========================================================================

/**
 * Asserts that every commission in `ids` is available to be attached to a
 * batch: it exists, is APPROVED, and is not currently held by another
 * non-terminal, non-failed batch.
 *
 * Runs with the session so the check is consistent with the write it
 * gates. This is the enforcement of the one-non-terminal-batch-per-
 * commission invariant — it CANNOT be a static index because the batch's
 * status lives on the batch, not on the commission.
 *
 * Returns the loaded commissions (with netAmount, period, agentId) so
 * callers can sum them without a second query.
 */
async function loadEligibleCommissions(
  ids: Types.ObjectId[],
  session: mongoose.ClientSession,
): Promise<
  {
    _id: Types.ObjectId;
    agentId: Types.ObjectId;
    period: string;
    netAmount: Money;
    status: string;
    payoutBatchId: Types.ObjectId | null;
  }[]
> {
  if (ids.length === 0) return [];
  const docs = await Commission.find({ _id: { $in: ids } })
    .session(session)
    .lean<
      {
        _id: Types.ObjectId;
        agentId: Types.ObjectId;
        period: string;
        netAmount: Money;
        status: string;
        payoutBatchId: Types.ObjectId | null;
      }[]
    >()
    .exec();

  if (docs.length !== ids.length) {
    throw new BadRequestError('One or more commission ids do not exist');
  }

  for (const d of docs) {
    if (d.status !== 'APPROVED') {
      throw new BadRequestError(
        `Commission ${d._id} is in status ${d.status}; only APPROVED commissions can be batched`,
      );
    }
    if (d.payoutBatchId) {
      // Held by some other batch. Is that batch FAILED? If so, the hold is
      // stale and the commission is available. If not, it's committed.
      const holder = await PayoutBatch.findById(d.payoutBatchId)
        .session(session)
        .lean<{ status: string }>()
        .exec();
      if (holder && holder.status !== 'FAILED') {
        throw new ConflictError(
          `Commission ${d._id} is already held by batch ${String(d.payoutBatchId)} in status ${holder.status}`,
        );
      }
    }
  }

  return docs;
}

/**
 * Recompute a DRAFT batch's totalAmount from its current commissionIds.
 * Loads the commissions by id and sums their netAmounts. Does NOT apply
 * the "eligible" check — these commissions are already in this batch,
 * by definition the one-non-terminal-batch-per-commission rule does not
 * apply to them.
 *
 * All amounts must share a currency; sumCommissionNetAmounts enforces it.
 */
async function recomputeDraftTotal(
  batch: InstanceType<typeof PayoutBatch>,
  session: mongoose.ClientSession,
): Promise<void> {
  const ids = (batch.commissionIds as Types.ObjectId[]) ?? [];
  if (ids.length === 0) {
    batch.totalAmount = { amount: 0, currency: 'XAF' } as never;
    return;
  }
  const docs = await Commission.find({ _id: { $in: ids } })
    .session(session)
    .lean<{ netAmount: Money }[]>()
    .exec();
  if (docs.length !== ids.length) {
    throw new Error('Batch references a commission that no longer exists');
  }
  const total = sumCommissionNetAmounts(docs.map((d) => ({ netAmount: d.netAmount })));
  batch.totalAmount = total as never;
}

// ===========================================================================
// Read helpers
// ===========================================================================

export async function listBatches(
  user: AuthMe,
  query: ListBatchesQuery,
): Promise<Paginated<PayoutBatchView>> {
  await connectDb();

  const filter: Record<string, unknown> = {};
  if (query.agentId) filter.agentId = new Types.ObjectId(query.agentId);
  if (query.status) filter.status = query.status;
  if (query.period) filter.period = query.period;

  if (user.subjectType === 'AGENT') {
    filter.agentId = new Types.ObjectId(user.agentId);
  }

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    PayoutBatch.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    PayoutBatch.countDocuments(filter),
  ]);

  const items = docs.map((d) => toBatchView(d as unknown as Record<string, unknown>));

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

export async function getBatch(user: AuthMe, id: string): Promise<PayoutBatchView> {
  await connectDb();
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestError('id is not a valid identifier');
  }
  const doc = await PayoutBatch.findById(id).lean().exec();
  if (!doc) throw new NotFoundError('Batch not found');
  assertCanAccessAgent(user, String(doc.agentId));
  return toBatchView(doc as unknown as Record<string, unknown>);
}

// ===========================================================================
// createBatch
// ===========================================================================

/**
 * Creates a DRAFT batch for one agent and one period, auto-selecting every
 * APPROVED commission for that agent/period that is not already held by a
 * non-terminal, non-failed batch.
 *
 * Rules:
 *   - The agent must exist and be ACTIVE or SUSPENDED. INACTIVE and
 *     TERMINATED agents are rejected.
 *   - All included commissions must be APPROVED and share the same
 *     `period` (which becomes the batch's period, per Z6).
 *   - All included commissions must share a currency.
 *   - The total must be >= 5,000 XAF (Z7).
 *   - At least one commission must be included (empty batches are rejected).
 *   - The method is the agent's current payoutPreference.method, or an
 *     explicit override from the request body.
 *   - Every attached commission gets its `payoutBatchId` set to the new
 *     batch's id — atomically, in the same transaction.
 *
 * Idempotency: `(agentId, period)` is unique among non-FAILED batches.
 * A second create for the same agent/period returns 409.
 */
export async function createBatch(user: AuthMe, body: CreateBatchBody): Promise<PayoutBatchView> {
  await connectDb();

  assertCanAccessAgent(user, body.agentId);

  const agent = await Agent.findById(body.agentId).lean<{
    _id: Types.ObjectId;
    status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';
    payoutPreference: { method: PayoutMethod };
  }>();
  if (!agent) throw new BadRequestError('agentId does not reference an existing agent');
  if (agent.status === 'TERMINATED' || agent.status === 'INACTIVE') {
    throw new BadRequestError(`Cannot create a batch for an agent in status ${agent.status}`);
  }

  const method: PayoutMethod = body.method ?? agent.payoutPreference.method;

  const session = await mongoose.startSession();
  try {
    let created: PayoutBatchView | null = null;

    await session.withTransaction(async () => {
      // 1. Load every APPROVED commission for this agent/period that is
      //    not held by a non-terminal, non-failed batch.
      const candidates = await Commission.find({
        agentId: new Types.ObjectId(body.agentId),
        period: body.period,
        status: 'APPROVED',
      })
        .session(session)
        .lean<
          {
            _id: Types.ObjectId;
            netAmount: Money;
            payoutBatchId: Types.ObjectId | null;
          }[]
        >()
        .exec();

      if (candidates.length === 0) {
        throw new BadRequestError('No APPROVED commissions found for this agent and period');
      }

      // 2. Filter out any held by a non-terminal, non-failed batch.
      const eligible: typeof candidates = [];
      for (const c of candidates) {
        if (!c.payoutBatchId) {
          eligible.push(c);
          continue;
        }
        const holder = await PayoutBatch.findById(c.payoutBatchId)
          .session(session)
          .lean<{ status: string }>()
          .exec();
        if (!holder || holder.status === 'FAILED') {
          eligible.push(c); // stale hold; commission is available
        }
      }
      if (eligible.length === 0) {
        throw new BadRequestError(
          'All APPROVED commissions for this agent and period are already in a batch',
        );
      }

      // 3. Sum, threshold check.
      const total = sumCommissionNetAmounts(eligible.map((c) => ({ netAmount: c.netAmount })));
      assertMeetsMinimumBatchAmount(total);

      // 4. Insert the batch.
      const [batch] = await PayoutBatch.create(
        [
          {
            agentId: new Types.ObjectId(body.agentId),
            period: body.period,
            commissionIds: eligible.map((c) => c._id),
            totalAmount: total,
            status: 'DRAFT',
            method,
            createdBy: new Types.ObjectId(user.subjectId),
          },
        ],
        { session },
      );
      if (!batch) throw new Error('PayoutBatch.create returned no document');

      // 5. Attach: set each commission's payoutBatchId.
      await Commission.updateMany(
        { _id: { $in: eligible.map((c) => c._id) } },
        { $set: { payoutBatchId: batch._id } },
        { session },
      );

      // 6. Audit.
      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: 'ADMIN',
        entityType: 'PayoutBatch',
        entityId: String(batch._id),
        action: 'CREATE',
        before: null,
        after: {
          _id: String(batch._id),
          agentId: body.agentId,
          period: body.period,
          commissionIds: eligible.map((c) => String(c._id)),
          totalAmount: total,
          method,
          status: 'DRAFT',
        },
        session,
      });

      created = toBatchView(batch.toObject() as Record<string, unknown>);
    });

    if (!created) throw new Error('Transaction completed without a created batch');
    return created;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError('A non-failed batch already exists for this agent and period');
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

// ===========================================================================
// addCommissionToBatch / removeCommissionFromBatch
// ===========================================================================

export async function addCommissionToBatch(
  user: AuthMe,
  batchId: string,
  commissionId: string,
): Promise<PayoutBatchView> {
  await connectDb();

  if (!Types.ObjectId.isValid(batchId) || !Types.ObjectId.isValid(commissionId)) {
    throw new BadRequestError('Invalid id');
  }

  const session = await mongoose.startSession();
  try {
    let updated: PayoutBatchView | null = null;

    await session.withTransaction(async () => {
      const batch = await PayoutBatch.findById(batchId).session(session).exec();
      if (!batch) throw new NotFoundError('Batch not found');
      assertCanAccessAgent(user, String(batch.agentId));

      if (!isBatchEditable(batch.status as PayoutBatchStatus)) {
        throw new BadRequestError(`Batch is ${batch.status}; only DRAFT batches can be edited`);
      }

      const ids = (batch.commissionIds as Types.ObjectId[]) ?? [];
      const commissionObjectId = new Types.ObjectId(commissionId);
      if (ids.some((id) => String(id) === commissionId)) {
        throw new BadRequestError('Commission is already in this batch');
      }

      // Load and validate the commission.
      const loaded = await loadEligibleCommissions([commissionObjectId], session);
      const c = loaded[0]!;
      if (String(c.agentId) !== String(batch.agentId)) {
        throw new BadRequestError('Commission belongs to a different agent');
      }
      if (c.period !== batch.period) {
        throw new BadRequestError('Commission belongs to a different period');
      }

      // Attach on both sides.
      batch.commissionIds = [...ids, commissionObjectId] as never;
      await batch.save({ session });
      await Commission.updateOne(
        { _id: commissionObjectId },
        { $set: { payoutBatchId: batch._id } },
        { session },
      );

      // Recompute total.
      await recomputeDraftTotal(batch, session);
      await batch.save({ session });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: user.subjectType === 'ADMIN' ? 'ADMIN' : 'AGENT',
        entityType: 'PayoutBatch',
        entityId: String(batch._id),
        action: 'UPDATE',
        before: { commissionIds: ids.map((i) => String(i)) },
        after: {
          commissionIds: (batch.commissionIds as Types.ObjectId[]).map((i) => String(i)),
          totalAmount: batch.totalAmount,
        },
        session,
      });

      updated = toBatchView(batch.toObject() as Record<string, unknown>);
    });

    if (!updated) throw new Error('Transaction completed without an updated batch');
    return updated;
  } finally {
    await session.endSession();
  }
}

export async function removeCommissionFromBatch(
  user: AuthMe,
  batchId: string,
  commissionId: string,
): Promise<PayoutBatchView> {
  await connectDb();

  if (!Types.ObjectId.isValid(batchId) || !Types.ObjectId.isValid(commissionId)) {
    throw new BadRequestError('Invalid id');
  }

  const session = await mongoose.startSession();
  try {
    let updated: PayoutBatchView | null = null;

    await session.withTransaction(async () => {
      const batch = await PayoutBatch.findById(batchId).session(session).exec();
      if (!batch) throw new NotFoundError('Batch not found');
      assertCanAccessAgent(user, String(batch.agentId));

      if (!isBatchEditable(batch.status as PayoutBatchStatus)) {
        throw new BadRequestError(`Batch is ${batch.status}; only DRAFT batches can be edited`);
      }

      const ids = (batch.commissionIds as Types.ObjectId[]) ?? [];
      const commissionObjectId = new Types.ObjectId(commissionId);
      const found = ids.find((id) => String(id) === commissionId);
      if (!found) throw new NotFoundError('Commission is not in this batch');

      const remaining = ids.filter((id) => String(id) !== commissionId);

      batch.commissionIds = remaining as never;
      await batch.save({ session });
      await Commission.updateOne(
        { _id: commissionObjectId },
        { $set: { payoutBatchId: null } },
        { session },
      );

      // Recompute total. If remaining is empty, the batch is 0 XAF.
      if (remaining.length === 0) {
        batch.totalAmount = { amount: 0, currency: batch.totalAmount.currency } as never;
      } else {
        await recomputeDraftTotal(batch, session);
      }
      await batch.save({ session });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: user.subjectType === 'ADMIN' ? 'ADMIN' : 'AGENT',
        entityType: 'PayoutBatch',
        entityId: String(batch._id),
        action: 'UPDATE',
        before: { commissionIds: ids.map((i) => String(i)) },
        after: {
          commissionIds: remaining.map((i) => String(i)),
          totalAmount: batch.totalAmount,
        },
        session,
      });

      updated = toBatchView(batch.toObject() as Record<string, unknown>);
    });

    if (!updated) throw new Error('Transaction completed without an updated batch');
    return updated;
  } finally {
    await session.endSession();
  }
}

// ===========================================================================
// approveBatch / markBatchProcessing / markBatchPaid / markBatchFailed
// ===========================================================================

export async function approveBatch(user: AuthMe, batchId: string): Promise<PayoutBatchView> {
  return runBatchTransition(user, batchId, (batch) => {
    const before = { status: batch.status };
    assertValidBatchTransition(batch.status as PayoutBatchStatus, 'APPROVED');
    if ((batch.commissionIds as Types.ObjectId[]).length === 0) {
      throw new BadRequestError('Cannot approve an empty batch');
    }
    // Re-check the minimum at approval (Z7). A DRAFT can dip below the
    // threshold if a commission was removed after creation.
    assertMeetsMinimumBatchAmount(batch.totalAmount as unknown as Money);
    batch.status = 'APPROVED';
    batch.approvedBy = new Types.ObjectId(user.subjectId);
    batch.approvedAt = new Date();
    return {
      action: 'APPROVE',
      before,
      after: {
        status: 'APPROVED',
        approvedBy: user.subjectId,
        approvedAt: batch.approvedAt.toISOString(),
        totalAmount: batch.totalAmount,
      },
    };
  });
}

export async function markBatchProcessing(user: AuthMe, batchId: string): Promise<PayoutBatchView> {
  return runBatchTransition(user, batchId, (batch) => {
    const before = { status: batch.status };
    assertValidBatchTransition(batch.status as PayoutBatchStatus, 'PROCESSING');
    batch.status = 'PROCESSING';
    return { action: 'UPDATE', before, after: { status: 'PROCESSING' } };
  });
}

/**
 * Marks a batch PAID. Flips every commission in the batch from APPROVED
 * to PAID, atomically. Requires paymentReference for MOBILE_MONEY and
 * BANK (Z5).
 */
export async function markBatchPaid(
  user: AuthMe,
  batchId: string,
  body: MarkPaidBody,
): Promise<PayoutBatchView> {
  await connectDb();

  if (!Types.ObjectId.isValid(batchId)) {
    throw new BadRequestError('id is not a valid identifier');
  }

  const session = await mongoose.startSession();
  try {
    let updated: PayoutBatchView | null = null;

    await session.withTransaction(async () => {
      const batch = await PayoutBatch.findById(batchId).session(session).exec();
      if (!batch) throw new NotFoundError('Batch not found');
      assertCanAccessAgent(user, String(batch.agentId));

      const before = { status: batch.status };
      assertValidBatchTransition(batch.status as PayoutBatchStatus, 'PAID');

      // Z5: paymentReference required for MOBILE_MONEY and BANK.
      const method = batch.method as PayoutMethod;
      if ((method === 'MOBILE_MONEY' || method === 'BANK') && !body.paymentReference) {
        throw new BadRequestError(`paymentReference is required when method is ${method}`);
      }

      // Load and validate every commission is still APPROVED.
      const ids = (batch.commissionIds as Types.ObjectId[]) ?? [];
      const commissions = await Commission.find({ _id: { $in: ids } })
        .session(session)
        .lean<{ _id: Types.ObjectId; status: string }[]>()
        .exec();
      if (commissions.length !== ids.length) {
        throw new Error('Batch references a commission that no longer exists');
      }
      for (const c of commissions) {
        if (c.status !== 'APPROVED') {
          throw new BadRequestError(
            `Cannot mark batch PAID: commission ${c._id} is in status ${c.status}`,
          );
        }
      }

      // Flip every commission to PAID.
      await Commission.updateMany(
        { _id: { $in: ids } },
        {
          $set: { status: 'PAID', paidAt: new Date(), paidBy: new Types.ObjectId(user.subjectId) },
        },
        { session },
      );

      // Update the batch.
      batch.status = 'PAID';
      batch.paidBy = new Types.ObjectId(user.subjectId);
      batch.paidAt = new Date();
      if (body.paymentReference) batch.paymentReference = body.paymentReference;
      await batch.save({ session });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: user.subjectType === 'ADMIN' ? 'ADMIN' : 'AGENT',
        entityType: 'PayoutBatch',
        entityId: String(batch._id),
        action: 'PAY',
        before,
        after: {
          status: 'PAID',
          paidBy: user.subjectId,
          paidAt: batch.paidAt.toISOString(),
          paymentReference: body.paymentReference ?? null,
        },
        session,
      });

      updated = toBatchView(batch.toObject() as Record<string, unknown>);
    });

    if (!updated) throw new Error('Transaction completed without an updated batch');
    return updated;
  } finally {
    await session.endSession();
  }
}

/**
 * Marks a batch FAILED. Releases every commission in the batch: clears
 * its payoutBatchId so a new batch can pick it up (Z3b). The batch stays
 * forever as a historical record.
 */
export async function markBatchFailed(
  user: AuthMe,
  batchId: string,
  reason: string,
): Promise<PayoutBatchView> {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new BadRequestError('reason is required');
  }

  await connectDb();
  if (!Types.ObjectId.isValid(batchId)) {
    throw new BadRequestError('id is not a valid identifier');
  }

  const session = await mongoose.startSession();
  try {
    let updated: PayoutBatchView | null = null;

    await session.withTransaction(async () => {
      const batch = await PayoutBatch.findById(batchId).session(session).exec();
      if (!batch) throw new NotFoundError('Batch not found');
      assertCanAccessAgent(user, String(batch.agentId));

      const before = { status: batch.status };
      assertValidBatchTransition(batch.status as PayoutBatchStatus, 'FAILED');

      const ids = (batch.commissionIds as Types.ObjectId[]) ?? [];

      // Release every commission so a new batch can pick them up.
      if (ids.length > 0) {
        await Commission.updateMany(
          { _id: { $in: ids } },
          { $set: { payoutBatchId: null } },
          { session },
        );
      }

      batch.status = 'FAILED';
      batch.failedAt = new Date();
      batch.failureReason = reason.trim();
      await batch.save({ session });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType:'ADMIN',
        entityType: 'PayoutBatch',
        entityId: String(batch._id),
        action: 'UPDATE',
        before,
        after: { status: 'FAILED', failureReason: reason.trim() },
        reason: reason.trim(),
        session,
      });

      logger.warn('payout batch failed', {
        event: 'payout.batch.failed',
        batchId: String(batch._id),
        agentId: String(batch.agentId),
        period: batch.period,
        method: batch.method,
        totalAmount: batch.totalAmount,
        commissionCount: (batch.commissionIds as Types.ObjectId[]).length,
        reason: reason.trim(),
      });

      updated = toBatchView(batch.toObject() as Record<string, unknown>);
    });

    if (!updated) throw new Error('Transaction completed without an updated batch');
    return updated;
  } finally {
    await session.endSession();
  }
}

// ===========================================================================
// Shared transition runner
// ===========================================================================

type TransitionResult = {
  action: 'APPROVE' | 'PAY' | 'UPDATE';
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason?: string;
};

async function runBatchTransition(
  user: AuthMe,
  batchId: string,
  apply: (batch: InstanceType<typeof PayoutBatch>) => TransitionResult,
): Promise<PayoutBatchView> {
  await connectDb();
  if (!Types.ObjectId.isValid(batchId)) {
    throw new BadRequestError('id is not a valid identifier');
  }

  const session = await mongoose.startSession();
  try {
    let updated: PayoutBatchView | null = null;

    await session.withTransaction(async () => {
      const batch = await PayoutBatch.findById(batchId).session(session).exec();
      if (!batch) throw new NotFoundError('Batch not found');
      assertCanAccessAgent(user, String(batch.agentId));

      const result = apply(batch);
      await batch.save({ session });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: user.subjectType === 'ADMIN' ? 'ADMIN' : 'AGENT',
        entityType: 'PayoutBatch',
        entityId: String(batch._id),
        action: result.action,
        before: result.before,
        after: result.after,
        reason: result.reason,
        session,
      });

      updated = toBatchView(batch.toObject() as Record<string, unknown>);
    });

    if (!updated) throw new Error('Transaction completed without an updated batch');
    return updated;
  } finally {
    await session.endSession();
  }
}

// ===========================================================================
// Helpers
// ===========================================================================

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}
