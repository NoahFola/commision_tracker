import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';

export const AGENT_TYPES = ['AGENT', 'AMBASSADOR'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'TERMINATED'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const PAYOUT_METHODS = ['MOBILE_MONEY', 'BANK', 'CASH'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/**
 * Onboarding journey stages, distinct from `status`.
 *  - status answers "is this agent allowed to operate?"
 *  - onboardingStage answers "how complete is their setup?"
 * A forward-only progression; transitions are admin-driven at MVP.
 * `ONBOARDED` is the terminal stage (not `ACTIVE`, to avoid confusion
 * with `Agent.status`).
 */
export const ONBOARDING_STAGES = [
  'REGISTERED',
  'PROFILE_COMPLETE',
  'VERIFIED',
  'ONBOARDED',
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

const payoutPreferenceSchema = new Schema(
  {
    method: { type: String, required: true, enum: PAYOUT_METHODS },
    provider: { type: String, trim: true, maxlength: 100 },
    accountNumber: { type: String, trim: true, maxlength: 100 },
    accountName: { type: String, trim: true, maxlength: 200 },
    isDefault: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

/**
 * Agent / Ambassador profile.
 *
 * Identity model: the Agent profile is distinct from the AgentUser auth
 * identity. One Agent → one AgentUser.
 *
 * Status semantics:
 *  - ACTIVE      — normal.
 *  - SUSPENDED   — temporarily blocked; reversible by admin.
 *  - INACTIVE    — paused; reversible by admin.
 *  - TERMINATED  — terminal. Cannot be reactivated.
 */
const agentSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },

    type: { type: String, required: true, enum: AGENT_TYPES },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 30,
      index: true,
    },

    regionId: {
      type: Schema.Types.ObjectId,
      ref: 'Region',
      required: true,
    },

    referralCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: AGENT_STATUSES,
      default: 'ACTIVE',
    },

    onboardingStage: {
      type: String,
      required: true,
      enum: ONBOARDING_STAGES,
      default: 'REGISTERED',
    },

    /**
     * Commission rate for this agent, in basis points (1/100 of a percent).
     * 500 = 5.00%. Bounds enforced by the schema.
     *
     * Basis points rather than a float because: (a) all our money math is
     * integer, (b) 0.05 is not exactly representable as a float, (c) a
     * rate in bp multiplies cleanly against an integer minor-unit amount
     * in XAF.
     *
     * Locked at commission creation (see C-T3): the Commission row stores
     * `rateApplied` so that later changes here do not retroactively alter
     * past commissions.
     */
    commissionRate: {
      type: Number,
      required: true,
      default: 500,
      min: 0,
      max: 10000,
    },

    dateJoined: { type: Date, required: true, default: () => new Date() },

    payoutPreference: { type: payoutPreferenceSchema, required: true },

    profilePictureUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: null,
    },
  },
  { timestamps: true, collection: 'agents' },
);

agentSchema.index({ regionId: 1, status: 1 });

export type AgentDoc = InferSchemaType<typeof agentSchema>;

export const Agent: Model<AgentDoc> = registerModel<AgentDoc>('Agent', agentSchema);
