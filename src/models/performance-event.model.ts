import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';
import { MoneySchema, type MoneyDoc } from '@/lib/money';

/**
 * Append-only daily performance snapshot for one Agent/Ambassador.
 *
 * MODEL: multiple rows per (agentId, dayKey) are allowed. This is intentional
 * (M4 decision (b)): historical records are never mutated; a correction is a
 * new row with `supersedesId` pointing at the row it replaces, plus a reason.
 * The "current" row for a given day is the latest non-superseded one.
 *
 * `dayKey` is the canonical WAT calendar day, 'YYYY-MM-DD'. `date` is the
 * corresponding UTC Date at WAT 00:00 for that day, for range queries.
 * Both are stored so no caller ever has to guess which representation is
 * authoritative. Callers should use src/lib/time helpers to compute both.
 *
 * `revenueAttributed` is Money (integer minor units + currency). It may be
 * zero. It may be negative if the correction reduces revenue — the fields are
 * snapshots of a day's totals, not debits/credits.
 */
const performanceEventSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },

    // Canonical WAT day. Indexed together with agentId below.
    dayKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    // Same day, as a Date at WAT 00:00 (UTC). For range queries.
    date: {
      type: Date,
      required: true,
    },

    // Counts of activity for the day.
    leadsGenerated: { type: Number, required: true, min: 0, default: 0 },
    dealsClosed: { type: Number, required: true, min: 0, default: 0 },
    propertiesReferred: { type: Number, required: true, min: 0, default: 0 },
    landlordsOnboarded: { type: Number, required: true, min: 0, default: 0 },
    tenantsOnboarded: { type: Number, required: true, min: 0, default: 0 },

    // Revenue attributed to the agent for this day. May be zero.
    revenueAttributed: { type: MoneySchema, required: true },

    // Set only on corrective rows. Points at the row this one supersedes.
    supersedesId: {
      type: Schema.Types.ObjectId,
      ref: 'PerformanceEvent',
      default: null,
    },

    // Required when supersedesId is set. Free text.
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Who wrote this row. Always an Admin at MVP.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  { timestamps: true, collection: 'performance_events' },
);

/**
 * "Find the latest row for agent X on day Y" — the core read pattern.
 * Day is the leading discriminator (range scans in reports), then recency.
 */
performanceEventSchema.index({ agentId: 1, dayKey: 1, createdAt: -1 });

/**
 * "Find every row that supersedes row R" — used to walk correction chains.
 */
performanceEventSchema.index({ supersedesId: 1 }, { sparse: true });

/**
 * Cross-field rule: `reason` is required whenever `supersedesId` is set.
 * Not enforceable as a field-level validator because it depends on another
 * field, so it lives on the schema.
 */
performanceEventSchema.pre('validate', function () {
  const doc = this as unknown as {
    supersedesId?: unknown;
    reason?: string;
    invalidate: (path: string, msg: string) => void;
  };
  if (doc.supersedesId && (!doc.reason || doc.reason.trim().length === 0)) {
    doc.invalidate('reason', 'reason is required when superseding a prior record');
  }
});

export type PerformanceEventDoc = InferSchemaType<typeof performanceEventSchema>;

export const PerformanceEvent: Model<PerformanceEventDoc> = registerModel<PerformanceEventDoc>(
  'PerformanceEvent',
  performanceEventSchema,
);

export type { MoneyDoc };
