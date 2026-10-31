import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';
import { MoneySchema } from '@/lib/money';

export const COMMISSION_STATUSES = ['PENDING', 'VERIFIED', 'APPROVED', 'PAID'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

/**
 * A single commission owed to an agent for a signed customer's first
 * month of subscription. This is the financial heart of the Tracker.
 *
 * Invariants (locked in Phase 5 kickoff):
 *   - Immutable once APPROVED or beyond. Corrections are mirror rows,
 *     not edits. See `reversesCommissionId`.
 *   - Amounts are integers in the smallest unit of a single currency
 *     (XAF: whole francs). Never floats. Currency required.
 *   - One commission per (agent, customer, period) — enforced by a
 *     unique partial index. See model indexes below.
 *   - One reversal per (agent, customer) — a reversal is a mirror row
 *     with negative amounts and `reversesCommissionId` set.
 *   - `status` never goes backward. See commission.service for the
 *     transition table.
 *   - A PAID commission cannot be reversed in this phase. Corrections
 *     after payment are clawbacks — modelled in Phase 6.
 *
 * Reversal is a MIRROR, not a flip:
 *   The original row's status is never modified after it reaches PAID
 *   or APPROVED. Reversing commission X creates a NEW row with
 *   `reversesCommissionId = X._id` and negative gross/net/fee amounts
 *   in the same currency. Reporting sums both rows and cancels to zero.
 *   A commission is "reversed" if and only if some other row points at
 *   it via `reversesCommissionId`.
 */
const commissionSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },

    /**
     * Opaque identifier from the core EpsiHome platform. The Tracker does
     * not own this value; it just records it so a commission can be traced
     * back to the customer whose subscription triggered it.
     */
    coreCustomerId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    /** When the customer's first payment was confirmed (source of `period`). */
    firstPaymentConfirmedAt: {
      type: Date,
      required: true,
    },

    /**
     * Qualification month in WAT, 'YYYY-MM'. Derived from
     * firstPaymentConfirmedAt at creation. Drives payout timing in Phase 6.
     */
    period: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
    },

    /** Subscription revenue used to compute gross. Admin-entered. */
    baseAmount: { type: MoneySchema, required: true },

    /** Agent's commission rate at creation time, in basis points. Locked. */
    rateApplied: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
    },

    /** Platform fee rate at creation time, in basis points. Locked. */
    platformFeeRateApplied: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
    },

    /** baseAmount * rateApplied / 10000. Integer minor units. */
    grossAmount: { type: MoneySchema, required: true },

    /** grossAmount * platformFeeRateApplied / 10000. Integer minor units. */
    platformFee: { type: MoneySchema, required: true },

    /** grossAmount - platformFee. Integer minor units. */
    netAmount: { type: MoneySchema, required: true },

    status: {
      type: String,
      required: true,
      enum: COMMISSION_STATUSES,
      default: 'PENDING',
    },

    // Lifecycle actors and timestamps. Each step records its own actor,
    // separately, because verify and approve are two distinct actions.
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    verifiedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    paidAt: { type: Date },
    payoutBatchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch' },

    /**
     * Reversal fields. A reversal is a NEW row pointing at its original.
     * The original is never modified.
     */
    reversesCommissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Commission',
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  { timestamps: true, collection: 'commissions' },
);

/**
 * Idempotency: one non-reversal commission per (agent, customer, period).
 * Reversals are also (agent, customer, period) but with the flag set —
 * separate uniqueness domain.
 *
 * Partial filter excludes reversal rows from the non-reversal constraint
 * so a reversal row can coexist with the row it reverses.
 */
commissionSchema.index(
  { agentId: 1, coreCustomerId: 1, period: 1 },
  {
    unique: true,
    partialFilterExpression: { reversesCommissionId: null },
    name: 'commission_unique_per_period',
  },
);

/**
 * At most one reversal per (agent, customer, period).
 */
commissionSchema.index(
  { agentId: 1, coreCustomerId: 1, period: 1, reversesCommissionId: 1 },
  {
    unique: true,
    partialFilterExpression: { reversesCommissionId: { $type: 'objectId' } },
    name: 'commission_unique_reversal_per_period',
  },
);

/**
 * "What has this agent earned / been paid?" — the core ledger query.
 */
commissionSchema.index({ agentId: 1, status: 1, period: -1 });

/**
 * "What belongs in this payout batch?" — used in Phase 6.
 */
commissionSchema.index({ payoutBatchId: 1, status: 1 });

/**
 * One non-terminal (PENDING/VERIFIED/APPROVED) commission can belong to
 * at most one non-terminal payout batch. Enforced in Phase 6 via a
 * partial unique index on payoutBatchId + a transaction guard; the
 * field lives here so it's part of the model from day one.
 */

export type CommissionDoc = InferSchemaType<typeof commissionSchema>;

export const Commission: Model<CommissionDoc> = registerModel<CommissionDoc>(
  'Commission',
  commissionSchema,
);
