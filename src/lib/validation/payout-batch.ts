import { Types } from 'mongoose';
import { BadRequestError } from '@/lib/errors/app-error';
import { PAYOUT_METHODS, type PayoutMethod } from '@/models/agent.model';
import { PAYOUT_BATCH_STATUSES } from '@/models/payout-batch.model';

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type CreateBatchBody = {
  agentId: string;
  period: string; // 'YYYY-MM'
  method?: PayoutMethod; // optional override; defaults to the agent's preference
};

export type ListBatchesQuery = {
  agentId?: string;
  status?: string;
  period?: string;
  page: number;
  limit: number;
};

export type MarkPaidBody = {
  paymentReference?: string;
};

export type FailBatchBody = {
  reason: string;
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

export function parseCreateBatchBody(input: unknown): CreateBatchBody {
  const o = asObject(input);

  const agentId = requireString(o.agentId, 'agentId', 100);
  if (!Types.ObjectId.isValid(agentId)) throw new BadRequestError('agentId is invalid');

  const period = requireString(o.period, 'period', 7);
  if (!/^\d{4}-\d{2}$/.test(period)) throw new BadRequestError('period must be YYYY-MM');

  let method: PayoutMethod | undefined;
  if (o.method !== undefined) {
    if (typeof o.method !== 'string' || !(PAYOUT_METHODS as readonly string[]).includes(o.method)) {
      throw new BadRequestError(`method must be one of: ${PAYOUT_METHODS.join(', ')}`);
    }
    method = o.method as PayoutMethod;
  }

  return { agentId, period, method };
}

export function parseMarkPaidBody(input: unknown): MarkPaidBody {
  const o = asObject(input);
  if (o.paymentReference === undefined || o.paymentReference === null) return {};
  if (typeof o.paymentReference !== 'string') {
    throw new BadRequestError('paymentReference must be a string');
  }
  const trimmed = o.paymentReference.trim();
  if (trimmed.length === 0) return {};
  if (trimmed.length > 200) throw new BadRequestError('paymentReference is too long');
  return { paymentReference: trimmed };
}

export function parseFailBatchBody(input: unknown): FailBatchBody {
  const o = asObject(input);
  return { reason: requireString(o.reason, 'reason', 500) };
}

export function parseListBatchesQuery(url: URL): ListBatchesQuery {
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
    if (!(PAYOUT_BATCH_STATUSES as readonly string[]).includes(statusRaw)) {
      throw new BadRequestError(`status must be one of: ${PAYOUT_BATCH_STATUSES.join(', ')}`);
    }
    status = statusRaw;
  }

  const periodRaw = url.searchParams.get('period');
  let period: string | undefined;
  if (periodRaw) {
    if (!/^\d{4}-\d{2}$/.test(periodRaw)) throw new BadRequestError('period must be YYYY-MM');
    period = periodRaw;
  }

  return { agentId, status, period, page, limit };
}

export function parseBatchIdParam(raw: string | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new BadRequestError('id is required');
  }
  if (!Types.ObjectId.isValid(raw)) {
    throw new BadRequestError('id is not a valid identifier');
  }
  return raw;
}

export type AddCommissionBody = {
  commissionId: string;
};

export function parseAddCommissionBody(input: unknown): AddCommissionBody {
  const o = asObject(input);
  const commissionId = requireString(o.commissionId, 'commissionId', 100);
  if (!Types.ObjectId.isValid(commissionId)) {
    throw new BadRequestError('commissionId is invalid');
  }
  return { commissionId };
}
