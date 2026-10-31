import { BadRequestError } from '@/lib/errors/app-error';

export type SummaryQuery = {
  period: string; // 'YYYY-MM', required
  includeEmpty: boolean; // default false (i.e. include empty agents)
};

export function parseSummaryQuery(url: URL): SummaryQuery {
  const periodRaw = url.searchParams.get('period');
  if (!periodRaw || !/^\d{4}-\d{2}$/.test(periodRaw)) {
    throw new BadRequestError('period is required and must be YYYY-MM');
  }

  const includeEmptyRaw = url.searchParams.get('includeEmpty');
  let includeEmpty = true;
  if (includeEmptyRaw !== null) {
    if (includeEmptyRaw === 'true') includeEmpty = true;
    else if (includeEmptyRaw === 'false') includeEmpty = false;
    else throw new BadRequestError('includeEmpty must be true or false');
  }

  return { period: periodRaw, includeEmpty };
}

import { AGENT_STATUSES, AGENT_TYPES } from '@/models/agent.model';
import { Types } from 'mongoose';

export type AgentExportQuery = {
  status?: string;
  type?: string;
  regionId?: string;
  ids?: string[];
};

/**
 * Parses query params for the agents CSV export. Mirrors the filters on
 * GET /api/agents, plus an optional `ids` list for exporting a selection.
 *
 * Pagination is ignored: exports return the whole filtered set.
 */
export function parseAgentExportQuery(url: URL): AgentExportQuery {
  const out: AgentExportQuery = {};

  const statusRaw = url.searchParams.get('status');
  if (statusRaw) {
    if (!(AGENT_STATUSES as readonly string[]).includes(statusRaw)) {
      throw new BadRequestError(`status must be one of: ${AGENT_STATUSES.join(', ')}`);
    }
    out.status = statusRaw;
  }

  const typeRaw = url.searchParams.get('type');
  if (typeRaw) {
    if (!(AGENT_TYPES as readonly string[]).includes(typeRaw)) {
      throw new BadRequestError(`type must be one of: ${AGENT_TYPES.join(', ')}`);
    }
    out.type = typeRaw;
  }

  const regionRaw = url.searchParams.get('regionId');
  if (regionRaw) {
    if (!Types.ObjectId.isValid(regionRaw)) {
      throw new BadRequestError('regionId is invalid');
    }
    out.regionId = regionRaw;
  }

  const idsRaw = url.searchParams.getAll('ids');
  if (idsRaw.length > 0) {
    // `ids` may be supplied as ?ids=a&ids=b (repeat) or ?ids=a,b (comma).
    // Flatten and validate.
    const flattened = idsRaw.flatMap((v) => v.split(',')).filter((v) => v.length > 0);
    for (const id of flattened) {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`ids contains an invalid ObjectId: ${id}`);
      }
    }
    out.ids = flattened;
  }

  return out;
}

export type BatchSummaryQuery = {
  period: string | null;
};

/**
 * Parses query params for the payout-batches-summary endpoint.
 * Only `period` is meaningful; the endpoint summarizes across statuses
 * and agents by design.
 */
export function parseBatchSummaryQuery(url: URL): BatchSummaryQuery {
  const periodRaw = url.searchParams.get('period');
  if (periodRaw === null) return { period: null };
  if (!/^\d{4}-\d{2}$/.test(periodRaw)) {
    throw new BadRequestError('period must be YYYY-MM');
  }
  return { period: periodRaw };
}


export type CommissionSummaryQuery = {
  period: string | null;
  agentId: string | null;
};

/**
 * Parses query params for the commissions-summary endpoint.
 * Only `period` and `agentId` are meaningful; the endpoint summarizes
 * across statuses by design, so status is not accepted as a filter.
 */
export function parseCommissionSummaryQuery(url: URL): CommissionSummaryQuery {
  const periodRaw = url.searchParams.get('period');
  let period: string | null = null;
  if (periodRaw) {
    if (!/^\d{4}-\d{2}$/.test(periodRaw)) {
      throw new BadRequestError('period must be YYYY-MM');
    }
    period = periodRaw;
  }

  const agentIdRaw = url.searchParams.get('agentId');
  let agentId: string | null = null;
  if (agentIdRaw) {
    if (!Types.ObjectId.isValid(agentIdRaw)) {
      throw new BadRequestError('agentId is invalid');
    }
    agentId = agentIdRaw;
  }

  return { period, agentId };
}
