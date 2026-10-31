import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseBatchSummaryQuery } from '@/lib/validation/report';
import { loadBatchSummary } from '@/services/report.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/payout-batches-summary
 * Admin-only. Returns per-status counts and totals for payout batches,
 * optionally filtered by period.
 *
 * Every status is present in the response, with zeros when no batches
 * match, so the UI can render a fixed grid.
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const url = new URL(request.url);
  const { period } = parseBatchSummaryQuery(url);
  const summary = await loadBatchSummary(user, period);
  return ok(summary);
});
