import { Types } from 'mongoose';
import { BadRequestError } from '@/lib/errors/app-error';
import { isCurrency, isValidMinorAmount, type Currency } from '@/lib/money';

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type CreateCommissionBody = {
  agentId: string;
  coreCustomerId: string;
  firstPaymentConfirmedAt: string; // ISO
  baseAmount: { amount: number; currency: Currency };
};

export type ReverseCommissionBody = {
  reason: string;
};

export type ListCommissionsQuery = {
  agentId?: string;
  status?: string;
  period?: string;
  page: number;
  limit: number;
};

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

function parseMoney(input: unknown, field: string): { amount: number; currency: Currency } {
  const o = asObject(input);
  if (typeof o.amount !== 'number' || !Number.isInteger(o.amount)) {
    throw new BadRequestError(`${field}.amount must be an integer`);
  }
  if (typeof o.currency !== 'string' || !isCurrency(o.currency)) {
    throw new BadRequestError(`${field}.currency is invalid`);
  }
  if (!isValidMinorAmount(o.amount, o.currency)) {
    throw new BadRequestError(`${field}.amount is invalid`);
  }
  return { amount: o.amount, currency: o.currency };
}

export function parseCreateCommissionBody(input: unknown): CreateCommissionBody {
  const o = asObject(input);

  const agentId = requireString(o.agentId, 'agentId', 100);
  if (!Types.ObjectId.isValid(agentId)) throw new BadRequestError('agentId is invalid');

  const coreCustomerId = requireString(o.coreCustomerId, 'coreCustomerId', 100);

  const firstPaymentRaw = requireString(o.firstPaymentConfirmedAt, 'firstPaymentConfirmedAt', 40);
  const firstPaymentDate = new Date(firstPaymentRaw);
  if (Number.isNaN(firstPaymentDate.getTime())) {
    throw new BadRequestError('firstPaymentConfirmedAt is not a valid date');
  }

  const baseAmount = parseMoney(o.baseAmount, 'baseAmount');

  return {
    agentId,
    coreCustomerId,
    firstPaymentConfirmedAt: firstPaymentDate.toISOString(),
    baseAmount,
  };
}

export function parseReverseCommissionBody(input: unknown): ReverseCommissionBody {
  const o = asObject(input);
  return { reason: requireString(o.reason, 'reason', 500) };
}

export function parseListCommissionsQuery(url: URL): ListCommissionsQuery {
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

  const agentIdRaw = url.searchParams.get('agentId');
  let agentId: string | undefined;
  if (agentIdRaw) {
    if (!Types.ObjectId.isValid(agentIdRaw)) throw new BadRequestError('agentId is invalid');
    agentId = agentIdRaw;
  }

  const statusRaw = url.searchParams.get('status');
  let status: string | undefined;
  if (statusRaw) {
    const allowed = ['PENDING', 'VERIFIED', 'APPROVED', 'PAID'];
    if (!allowed.includes(statusRaw)) {
      throw new BadRequestError(`status must be one of: ${allowed.join(', ')}`);
    }
    status = statusRaw;
  }

  const periodRaw = url.searchParams.get('period');
  let period: string | undefined;
  if (periodRaw) {
    if (!/^\d{4}-\d{2}$/.test(periodRaw)) {
      throw new BadRequestError('period must be YYYY-MM');
    }
    period = periodRaw;
  }

  return { agentId, status, period, page, limit };
}

/**
 * Validates a raw path parameter as a Mongo ObjectId.
 * Throws BadRequestError on malformed input so the route returns 400
 * rather than letting Mongoose raise a CastError inside a query.
 */
export function parseCommissionIdParam(raw: string | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new BadRequestError('id is required');
  }
  if (!Types.ObjectId.isValid(raw)) {
    throw new BadRequestError('id is not a valid identifier');
  }
  return raw;
}
