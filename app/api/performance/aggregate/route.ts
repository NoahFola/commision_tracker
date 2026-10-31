import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseAggregatePerformanceQuery } from '@/lib/validation/performance';
import { aggregateEvents } from '@/services/performance.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/performance/aggregate
 * Daily / weekly / monthly rollup of performance events.
 *
 * Scoped to the caller (admin: all agents, filterable by ?agentId=;
 * agent: their own rows only, any ?agentId= is silently narrowed).
 *
 * Query params:
 *   - granularity: 'daily' | 'weekly' | 'monthly' (default 'daily')
 *   - from / to:   'YYYY-MM-DD' WAT day keys, inclusive
 *                  (default: last 30 days)
 *   - agentId:     optional ObjectId filter (admin only)
 *
 * Response: { granularity, from, to, buckets }
 * Buckets are sparse — days with no events contribute no bucket, not a
 * zero-filled row. See performance.service.aggregateEvents.
 */
export const GET = withAuth(
  ['ADMIN', 'AGENT'],
  async (request, _context, user): Promise<NextResponse> => {
    const url = new URL(request.url);
    const query = parseAggregatePerformanceQuery(url);
    const result = await aggregateEvents(user, query);
    return ok(result);
  },
);
