import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';

export const SESSION_SUBJECT_TYPES = ['ADMIN', 'AGENT'] as const;
export type SessionSubjectType = (typeof SESSION_SUBJECT_TYPES)[number];

/**
 * Server-side session.
 *
 * The cookie holds only `_id` — an opaque, unguessable 32-byte base64url
 * string. All authority lives here, which is what makes revocation work:
 * deleting a Session row immediately invalidates the cookie.
 *
 * Two expiries:
 *   - `idleExpiresAt` — sliding 7 days, refreshed on activity.
 *   - `expiresAt`     — absolute 30 days, never extended.
 * Both must be in the future for the session to be valid.
 *
 * TTL index on `idleExpiresAt` auto-deletes idle sessions. Absolute expiry is
 * enforced by application code on read (Mongo TTL has up to ~60s granularity).
 */
const sessionSchema = new Schema(
  {
    // Opaque session identifier. Not an ObjectId — we want raw randomness.
    _id: {
      type: String,
      required: true,
    },
    subjectType: {
      type: String,
      required: true,
      enum: SESSION_SUBJECT_TYPES,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    idleExpiresAt: {
      type: Date,
      required: true,
    },
    lastSeenAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    userAgentHash: {
      type: String,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'sessions' },
);

/**
 * TTL: Mongo deletes documents when `idleExpiresAt` passes.
 * expireAfterSeconds: 0 means "delete at the stored time".
 */
sessionSchema.index({ idleExpiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * "Revoke all sessions for this subject" — used on suspension, password
 * change, and admin action.
 */
sessionSchema.index({ subjectType: 1, subjectId: 1 });

export type SessionDoc = InferSchemaType<typeof sessionSchema>;

export const Session: Model<SessionDoc> = registerModel<SessionDoc>('Session', sessionSchema);
