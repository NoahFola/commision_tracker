import { Types } from 'mongoose';
import { BadRequestError } from '@/lib/errors/app-error';
import { isCurrency, isValidMinorAmount, type Currency } from '@/lib/money';
import { assertDayKey } from '@/lib/time';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const GRANULARITIES = ['daily', 'weekly', 'monthly'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_RANGE_DAYS = 30;

export type MoneyInput = { amount: number; currency: Currency };

export type CreatePerformanceBody = {
  agentId: string;
  dayKey: string;
  revenueAttributed: MoneyInput;
  leadsGenerated: number;
  dealsClosed: number;
  propertiesReferred: number;
  landlordsOnboarded: number;
  tenantsOnboarded: number;
  supersedesId?: string;
  reason?: string;
};

export type ListPerformanceQuery = {
  agentId?: string;
  from: string;
  to: string;
  onlyCurrent: boolean;
  page: number;
  limit: number;
};

export type AggregatePerformanceQuery = {
  agentId?: string;
  from: string;
  to: string;
  granularity: Granularity;
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

function nonNegInt(v: unknown, field: string): number {
  if (v === undefined) return 0;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new BadRequestError(`${field} must be a non-negative integer`);
  }
  return v;
}

function parseMoney(input: unknown): MoneyInput {
  if (input === undefined) {
    return { amount: 0, currency: 'XAF' };
  }
  const o = asObject(input);
  const amount = o.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new BadRequestError('revenueAttributed.amount must be an integer');
  }
  const currency = o.currency === undefined ? 'XAF' : o.currency;
  if (typeof currency !== 'string' || !isCurrency(currency)) {
    throw new BadRequestError('revenueAttributed.currency is invalid');
  }
  if (!isValidMinorAmount(amount, currency)) {
    throw new BadRequestError('revenueAttributed.amount is invalid');
  }
  return { amount, currency };
}

export function parseCreatePerformanceBody(input: unknown): CreatePerformanceBody {
  const o = asObject(input);

  const agentId = requireString(o.agentId, 'agentId', 100);
  if (!Types.ObjectId.isValid(agentId)) throw new BadRequestError('agentId is invalid');

  const dayKey = requireString(o.dayKey, 'dayKey', 10);
  if (!DAY_KEY_RE.test(dayKey)) throw new BadRequestError('dayKey must be YYYY-MM-DD');
  try {
    assertDayKey(dayKey);
  } catch {
    throw new BadRequestError('dayKey is invalid');
  }

  const supersedesId =
    o.supersedesId === undefined ? undefined : requireString(o.supersedesId, 'supersedesId', 100);
  if (supersedesId && !Types.ObjectId.isValid(supersedesId)) {
    throw new BadRequestError('supersedesId is invalid');
  }

  const reason = o.reason === undefined ? undefined : requireString(o.reason, 'reason', 500);
  if (supersedesId && !reason) {
    throw new BadRequestError('reason is required when supersedesId is set');
  }

  return {
    agentId,
    dayKey,
    revenueAttributed: parseMoney(o.revenueAttributed),
    leadsGenerated: nonNegInt(o.leadsGenerated, 'leadsGenerated'),
    dealsClosed: nonNegInt(o.dealsClosed, 'dealsClosed'),
    propertiesReferred: nonNegInt(o.propertiesReferred, 'propertiesReferred'),
    landlordsOnboarded: nonNegInt(o.landlordsOnboarded, 'landlordsOnboarded'),
    tenantsOnboarded: nonNegInt(o.tenantsOnboarded, 'tenantsOnboarded'),
    supersedesId,
    reason,
  };
}

function parseDayKeyParam(v: string | null, field: string): string {
  if (!v || !DAY_KEY_RE.test(v)) throw new BadRequestError(`${field} must be YYYY-MM-DD`);
  return v;
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now.getTime() - (DEFAULT_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000);
  const toKey = isoDateKey(to);
  const fromKey = isoDateKey(from);
  return { from: fromKey, to: toKey };
}

function isoDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseListPerformanceQuery(url: URL): ListPerformanceQuery {
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

  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const defaults = defaultRange();
  const from = fromRaw ? parseDayKeyParam(fromRaw, 'from') : defaults.from;
  const to = toRaw ? parseDayKeyParam(toRaw, 'to') : defaults.to;
  assertRangeWithinCap(from, to);

  const onlyCurrentRaw = url.searchParams.get('onlyCurrent');
  const onlyCurrent = onlyCurrentRaw === null ? true : onlyCurrentRaw !== 'false';

  return { agentId, from, to, onlyCurrent, page, limit };
}

export function parseAggregatePerformanceQuery(url: URL): AggregatePerformanceQuery {
  const agentIdRaw = url.searchParams.get('agentId');
  let agentId: string | undefined;
  if (agentIdRaw) {
    if (!Types.ObjectId.isValid(agentIdRaw)) throw new BadRequestError('agentId is invalid');
    agentId = agentIdRaw;
  }

  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const defaults = defaultRange();
  const from = fromRaw ? parseDayKeyParam(fromRaw, 'from') : defaults.from;
  const to = toRaw ? parseDayKeyParam(toRaw, 'to') : defaults.to;
  assertRangeWithinCap(from, to);

  const granRaw = url.searchParams.get('granularity') ?? 'daily';
  if (!(GRANULARITIES as readonly string[]).includes(granRaw)) {
    throw new BadRequestError(`granularity must be one of: ${GRANULARITIES.join(', ')}`);
  }
  const granularity = granRaw as Granularity;

  return { agentId, from, to, granularity };
}

/**
 * Maximum inclusive span allowed for a performance query, in days.
 * 366 covers a leap year. Both the list endpoint and the aggregate
 * endpoint enforce this. Rationale: a "safety cap" that rejects
 * over-long ranges is honest — silently truncating would produce
 * charts that look correct and are not.
 */
export const MAX_RANGE_DAYS = 366;

/**
 * Throws BadRequestError if the inclusive span from..to exceeds
 * MAX_RANGE_DAYS. `from` and `to` must already be well-formed
 * 'YYYY-MM-DD' keys.
 */
function assertRangeWithinCap(from: string, to: string): void {
  const fromTs = Date.parse(`${from}T00:00:00Z`);
  const toTs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromTs) || Number.isNaN(toTs)) {
    throw new BadRequestError('Invalid from/to');
  }
  if (toTs < fromTs) {
    throw new BadRequestError('to must be on or after from');
  }
  const spanDays = Math.floor((toTs - fromTs) / (24 * 60 * 60 * 1000)) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    throw new BadRequestError(
      `Date range too large: maximum span is ${MAX_RANGE_DAYS} days`,
    );
  }
}
