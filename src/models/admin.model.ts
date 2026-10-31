import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';

/**
 * Admin identity.
 *
 * Minimal by design: the Tracker has no staff roles at MVP (only Admin,
 * Agent, Ambassador). An Admin is seeded from env vars at server start
 * (see README) and is the actor for every financial/performance mutation
 * and every AuditLog row.
 *
 * Agents and Ambassadors do NOT live here — they authenticate via AgentUser.
 */
const adminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // bcrypt hash. Optional at the schema level so the seed script can create
    // the admin row first and set the hash in the same operation. Login
    // FAILS CLOSED if this is missing — see /api/auth/admin/login.
    passwordHash: {
      type: String,
      minlength: 20,
      default: null,
    },
    profilePictureUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: null,
    },
  },
  { timestamps: true, collection: 'admins' },
);

export type AdminDoc = InferSchemaType<typeof adminSchema>;

export const Admin: Model<AdminDoc> = registerModel<AdminDoc>('Admin', adminSchema);
