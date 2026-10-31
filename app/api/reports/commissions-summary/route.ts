import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCommissionSummaryQuery } from '@/lib/validation/report';
import { loadCommissionStatusSummary } from '@/services/report.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/commissions-summary
 * Admin-only. Returns per-status counts and net-amount totals for
 * commissions, optionally filtered by period and agent.
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const url = new URL(request.url);
  const query = parseCommissionSummaryQuery(url);
  const summary = await loadCommissionStatusSummary(user, query);
  return ok(summary);
});
