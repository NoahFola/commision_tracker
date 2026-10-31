import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';

/**
 * Auth identity for an Agent or Ambassador.
 *
 * Separate from Agent (the profile) by design — chosen in the identity-model
 * decision. 1:1 with Agent, enforced by a unique index on `agentId`.
 *
 * `email` is intended to match `Agent.email` — enforced in the service layer,
 * not by Mongo, because cross-collection uniqueness isn't expressible here.
 *
 * `passwordHash` stores an opaque hash. The hashing algorithm is decided in
 * Phase 2 (auth). This schema does not care which one — it only requires a
 * non-trivial string.
 *
 * No separate status: whether this identity can log in is governed by
 * `Agent.status` (SUSPENDED / TERMINATED block login).
 */
const agentUserSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 20,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  { timestamps: true, collection: 'agent_users' },
);

export type AgentUserDoc = InferSchemaType<typeof agentUserSchema>;

export const AgentUser: Model<AgentUserDoc> = registerModel<AgentUserDoc>(
  'AgentUser',
  agentUserSchema,
);
