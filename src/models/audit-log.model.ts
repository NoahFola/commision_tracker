import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'VERIFY',
  'APPROVE',
  'PAY',
  'REVERSE',
  'DELETE',
  'EXPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTOR_TYPES = ['ADMIN', 'AGENT'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

/**
 * Append-only audit log.
 *
 * Every lifecycle-relevant and financial mutation writes one row through
 * src/lib/audit/write-audit.ts — the single chokepoint. Nothing writes
 * to this collection directly.
 *
 * `actorEmail` is denormalized so the audit trail survives an admin rename
 * or removal (admins are never hard-deleted, but may be renamed).
 *
 * `diff` stores full before/after snapshots. For CREATE, `before` is null.
 * For status transitions and edits, both are populated. Storing full
 * snapshots — not computed field-level diffs — avoids a class of bugs
 * where the diff logic drifts from the schema.
 *
 * The log is never updated or deleted.
 */
const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    actorType: {
      type: String,
      required: true,
      enum: AUDIT_ACTOR_TYPES,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
    },
    diff: {
      type: {
        before: { type: Schema.Types.Mixed, default: null },
        after: { type: Schema.Types.Mixed, default: null },
      },
      required: true,
      default: () => ({ before: null, after: null }),
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    at: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { timestamps: { createdAt: false, updatedAt: false }, collection: 'audit_logs' },
);

/**
 * Primary lookup: "history of entity X". Descending `at` for latest-first.
 */
auditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });

/**
 * Secondary: "what did this admin do?" For compliance review.
 */
auditLogSchema.index({ actorId: 1, at: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> = registerModel<AuditLogDoc>('AuditLog', auditLogSchema);
