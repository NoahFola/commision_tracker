import { Types } from 'mongoose';
import { BadRequestError } from '@/lib/errors/app-error';
import {
  AGENT_TYPES,
  AGENT_STATUSES,
  PAYOUT_METHODS,
  ONBOARDING_STAGES,
  type AgentType,
  type AgentStatus,
  type PayoutMethod,
  type OnboardingStage,
} from '@/models/agent.model';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 \-()]{6,30}$/;

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type Pagination = { page: number; limit: number };
export type ListAgentsQuery = Pagination & {
  status?: AgentStatus;
  type?: AgentType;
  regionId?: string;
};

export type PayoutPreferenceBody = {
  method: PayoutMethod;
  provider?: string;
  accountNumber?: string;
  accountName?: string;
  isDefault?: boolean;
};

export type CreateAgentBody = {
  fullName: string;
  type: AgentType;
  email: string;
  phone: string;
  regionId: string;
  referralCode: string;
  status?: AgentStatus;
  onboardingStage?: OnboardingStage;
  payoutPreference: PayoutPreferenceBody;
  password: string; // for AgentUser (G2 = a)
};

export type UpdateAgentBody = Partial<{
  fullName: string;
  email: string;
  phone: string;
  regionId: string;
  referralCode: string;
  status: AgentStatus;
  onboardingStage: OnboardingStage;
  payoutPreference: PayoutPreferenceBody;
}>;

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestError('Invalid body');
  }
  return input as Record<string, unknown>;
}

function requireString(v: unknown, field: string, max = 500): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new BadRequestError(`${field} is required`);
  }
  if (v.length > max) throw new BadRequestError(`${field} is too long`);
  return v.trim();
}

function optionalString(v: unknown, field: string, max = 500): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new BadRequestError(`${field} must be a string`);
  if (v.length > max) throw new BadRequestError(`${field} is too long`);
  return v.trim();
}

function assertEnum<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new BadRequestError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}

function parsePayoutPreference(input: unknown): PayoutPreferenceBody {
  const o = asObject(input);
  const method = assertEnum(o.method, PAYOUT_METHODS, 'payoutPreference.method');
  return {
    method,
    provider: optionalString(o.provider, 'payoutPreference.provider', 100),
    accountNumber: optionalString(o.accountNumber, 'payoutPreference.accountNumber', 100),
    accountName: optionalString(o.accountName, 'payoutPreference.accountName', 200),
    isDefault: typeof o.isDefault === 'boolean' ? o.isDefault : undefined,
  };
}

export function parseCreateAgentBody(input: unknown): CreateAgentBody {
  const o = asObject(input);

  const email = requireString(o.email, 'email', 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new BadRequestError('email is invalid');

  const phone = requireString(o.phone, 'phone', 30);
  if (!PHONE_RE.test(phone)) throw new BadRequestError('phone is invalid');

  const regionId = requireString(o.regionId, 'regionId', 100);
  if (!Types.ObjectId.isValid(regionId)) throw new BadRequestError('regionId is invalid');

  const referralCode = requireString(o.referralCode, 'referralCode', 40).toUpperCase();

  const type = assertEnum(o.type, AGENT_TYPES, 'type');

  const status =
    o.status === undefined ? undefined : assertEnum(o.status, AGENT_STATUSES, 'status');
  const onboardingStage =
    o.onboardingStage === undefined
      ? undefined
      : assertEnum(o.onboardingStage, ONBOARDING_STAGES, 'onboardingStage');

  const password = requireString(o.password, 'password', 72);
  if (password.length < 10) {
    throw new BadRequestError('password must be at least 10 characters');
  }

  return {
    fullName: requireString(o.fullName, 'fullName', 200),
    type,
    email,
    phone,
    regionId,
    referralCode,
    status,
    onboardingStage,
    payoutPreference: parsePayoutPreference(o.payoutPreference),
    password,
  };
}

/**
 * PATCH semantics (G3 = a):
 *   - omitted field (undefined) => leave unchanged
 *   - null                       => clear the field (where clearable)
 */
export function parseUpdateAgentBody(input: unknown): UpdateAgentBody {
  const o = asObject(input);
  const out: UpdateAgentBody = {};

  if (o.fullName !== undefined) out.fullName = requireString(o.fullName, 'fullName', 200);

  if (o.email !== undefined) {
    const email = requireString(o.email, 'email', 200).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new BadRequestError('email is invalid');
    out.email = email;
  }

  if (o.phone !== undefined) {
    const phone = requireString(o.phone, 'phone', 30);
    if (!PHONE_RE.test(phone)) throw new BadRequestError('phone is invalid');
    out.phone = phone;
  }

  if (o.regionId !== undefined) {
    const regionId = requireString(o.regionId, 'regionId', 100);
    if (!Types.ObjectId.isValid(regionId)) throw new BadRequestError('regionId is invalid');
    out.regionId = regionId;
  }

  if (o.referralCode !== undefined) {
    out.referralCode = requireString(o.referralCode, 'referralCode', 40).toUpperCase();
  }

  if (o.status !== undefined) out.status = assertEnum(o.status, AGENT_STATUSES, 'status');

  if (o.onboardingStage !== undefined) {
    out.onboardingStage = assertEnum(o.onboardingStage, ONBOARDING_STAGES, 'onboardingStage');
  }

  if (o.payoutPreference !== undefined) {
    out.payoutPreference = parsePayoutPreference(o.payoutPreference);
  }

  return out;
}

export function parseListAgentsQuery(url: URL): ListAgentsQuery {
  const pageRaw = url.searchParams.get('page') ?? '1';
  const page = Number.parseInt(pageRaw, 10);
  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestError('page must be a positive integer');
  }

  const limitRaw = url.searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE);
  const limit = Number.parseInt(limitRaw, 10);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE ||
    !(PAGE_SIZE_OPTIONS as readonly number[]).includes(limit)
  ) {
    throw new BadRequestError(`limit must be one of: ${PAGE_SIZE_OPTIONS.join(', ')}`);
  }

  const statusRaw = url.searchParams.get('status');
  const typeRaw = url.searchParams.get('type');
  const regionIdRaw = url.searchParams.get('regionId');

  const query: ListAgentsQuery = { page, limit };
  if (statusRaw) query.status = assertEnum(statusRaw, AGENT_STATUSES, 'status');
  if (typeRaw) query.type = assertEnum(typeRaw, AGENT_TYPES, 'type');
  if (regionIdRaw) {
    if (!Types.ObjectId.isValid(regionIdRaw)) throw new BadRequestError('regionId is invalid');
    query.regionId = regionIdRaw;
  }
  return query;
}

/**
 * Validates a raw path parameter as a Mongo ObjectId.
 * Throws BadRequestError on malformed input so the route returns 400
 * rather than letting Mongoose raise a CastError inside a query.
 */
export function parseAgentIdParam(raw: string | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new BadRequestError('id is required');
  }
  if (!Types.ObjectId.isValid(raw)) {
    throw new BadRequestError('id is not a valid identifier');
  }
  return raw;
}

/**
 * Fields an agent may change about themselves via PATCH /api/agents/me.
 * Everything else — name, email, type, region, referral code, status,
 * onboarding stage, commission rate — is admin-only.
 */
export type UpdateMyProfileBody = {
  phone?: string;
  payoutPreference?: PayoutPreferenceBody;
  profilePictureUrl?: string | null;
};

/**
 * Fields an agent is NOT allowed to set. If any appears in the body, we
 * reject the whole request with 400 naming the field. This is stricter
 * than the admin PATCH (which silently ignores unknown fields) on
 * purpose: the agent should never wonder whether their attempt to
 * change their email half-succeeded.
 */
const FORBIDDEN_SELF_EDIT_FIELDS = [
  'fullName',
  'name',
  'email',
  'type',
  'regionId',
  'referralCode',
  'status',
  'onboardingStage',
  'commissionRate',
  'password',
] as const;

export function parseUpdateMyProfileBody(input: unknown): UpdateMyProfileBody {
  const o = asObject(input);

  for (const field of FORBIDDEN_SELF_EDIT_FIELDS) {
    if (field in o && o[field] !== undefined) {
      throw new BadRequestError(`${field} cannot be changed by the agent`);
    }
  }

  const out: UpdateMyProfileBody = {};

  if (o.phone !== undefined) {
    const phone = requireString(o.phone, 'phone', 30);
    if (!PHONE_RE.test(phone)) throw new BadRequestError('phone is invalid');
    out.phone = phone;
  }

  if (o.payoutPreference !== undefined) {
    out.payoutPreference = parsePayoutPreference(o.payoutPreference);
  }

  if (o.profilePictureUrl !== undefined) {
    if (o.profilePictureUrl === null) {
      out.profilePictureUrl = null;
    } else if (typeof o.profilePictureUrl !== 'string') {
      throw new BadRequestError('profilePictureUrl must be a string or null');
    } else {
      const trimmed = o.profilePictureUrl.trim();
      if (trimmed.length === 0) {
        out.profilePictureUrl = null;
      } else if (trimmed.length > 2048) {
        throw new BadRequestError('profilePictureUrl is too long');
      } else {
        out.profilePictureUrl = trimmed;
      }
    }
  }

  return out;
}