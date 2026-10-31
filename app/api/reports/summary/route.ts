import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseSummaryQuery } from '@/lib/validation/report';
import { loadSummary } from '@/services/report.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/summary?period=YYYY-MM
 * Admin-only. One row per agent for the period, plus totals.
 * Agents with no activity are included by default; pass
 * ?includeEmpty=false to skip them.
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const url = new URL(request.url);
  const { period, includeEmpty } = parseSummaryQuery(url);
  const summary = await loadSummary(user, period, includeEmpty);
  return ok(summary);
});
