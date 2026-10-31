import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';
import { MoneySchema } from '@/lib/money';

export const PAYOUT_BATCH_STATUSES = ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED'] as const;
export type PayoutBatchStatus = (typeof PAYOUT_BATCH_STATUSES)[number];

export const PAYOUT_METHODS = ['MOBILE_MONEY', 'BANK', 'CASH'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/**
 * A group of APPROVED commissions belonging to a single agent for a
 * single period, paid out as one transfer.
 *
 * Lifecycle (see payout-batch.service for the state machine):
 *   DRAFT -> APPROVED -> PROCESSING -> PAID
 *                    \-> FAILED
 *
 * Invariants (locked in Phase 6 kickoff):
 *   - One batch per (agent, period), excluding FAILED batches. A failed
 *     batch does NOT block creating a new batch for the same agent/period.
 *   - A commission can belong to at most one non-terminal, non-failed
 *     batch at a time. Enforced in the service via a transaction-guarded
 *     check, not an index (the batch's status is not on the commission).
 *   - All commissions in a batch share the same period. A batch's
 *     `period` is the commissions' period (Z6).
 *   - `totalAmount` is frozen at APPROVED. Later reversals of the
 *     underlying commissions do not change a batch's historical total.
 *   - `PAID` and `FAILED` are terminal.
 *   - A `FAILED` batch stays forever as a historical record. Its
 *     commissions have their `payoutBatchId` cleared so a new batch
 *     can pick them up.
 */
const payoutBatchSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },

    /** Qualification month of the commissions, 'YYYY-MM'. Same for all. */
    period: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
    },

    commissionIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Commission',
      required: true,
      default: [],
    },

    /** Sum of netAmount over commissionIds. Frozen at APPROVED. */
    totalAmount: { type: MoneySchema, required: true },

    status: {
      type: String,
      required: true,
      enum: PAYOUT_BATCH_STATUSES,
      default: 'DRAFT',
    },

    method: {
      type: String,
      required: true,
      enum: PAYOUT_METHODS,
    },

    /** MoMo transaction ID, bank reference, or 'cash'. See Z5. */
    paymentReference: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    // Lifecycle actors and timestamps.
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    paidAt: { type: Date },
    failedAt: { type: Date },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true, collection: 'payout_batches' },
);

/**
 * One batch per (agent, period), except that FAILED batches do not
 * block a new batch for the same agent/period. See Z3(b).
 */
payoutBatchSchema.index(
  { agentId: 1, period: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID'] } },
    name: 'payout_batch_unique_per_agent_period',
  },
);

/**
 * "List this agent's batches" / "batches in a period" — the primary reads.
 */
payoutBatchSchema.index({ agentId: 1, period: -1 });

/**
 * The work queue: "batches pending action" (DRAFT/APPROVED/PROCESSING).
 */
payoutBatchSchema.index({ status: 1, createdAt: -1 });

export type PayoutBatchDoc = InferSchemaType<typeof payoutBatchSchema>;

export const PayoutBatch: Model<PayoutBatchDoc> = registerModel<PayoutBatchDoc>(
  'PayoutBatch',
  payoutBatchSchema,
);
