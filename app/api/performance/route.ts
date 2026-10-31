import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import {
  parseCreatePerformanceBody,
  parseListPerformanceQuery,
} from '@/lib/validation/performance';
import { listEvents, recordEvent } from '@/services/performance.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/performance
 * Records a daily performance snapshot for an agent.
 * Optional `supersedesId` + `reason` marks this as a correction.
 * Admin-only; agents are read-only.
 */
export const POST = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const raw = await request.json().catch(() => {
    throw new BadRequestError('Invalid JSON body');
  });
  const body = parseCreatePerformanceBody(raw);
  const created = await recordEvent(user, body);
  return ok(created, { status: 201 });
});

/**
 * GET /api/performance
 * Paginated list of performance events, scoped to the caller.
 * Admin: all agents, filterable by `agentId`.
 * Agent: their own rows only (a mismatched `agentId` is silently ignored).
 *
 * Query params: page, limit, agentId, from, to, onlyCurrent.
 * Defaults: page=1, limit=10, range=last 30 days, onlyCurrent=true.
 */
export const GET = withAuth(
  ['ADMIN', 'AGENT'],
  async (request, _context, user): Promise<NextResponse> => {
    const url = new URL(request.url);
    const query = parseListPerformanceQuery(url);
    const page = await listEvents(user, query);
    return ok(page);
  },
);
