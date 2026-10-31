import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { loadAgentExportRows, auditExport } from '@/services/report.service';
import { toCsv, csvTimestampSuffix } from '@/lib/reports/csv';
import { parseAgentExportQuery } from '@/lib/validation/report';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'id',
  'fullName',
  'type',
  'email',
  'phone',
  'region',
  'status',
  'onboardingStage',
  'referralCode',
  'dateJoined',
  'commissionRate',
] as const;

/**
 * GET /api/reports/agents.csv
 * Admin-only. Returns the filtered agents list as CSV. Same filters as
 * GET /api/agents, plus an optional `ids` parameter for exporting a
 * selection:
 *   ?ids=abc&ids=def   or   ?ids=abc,def
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user) => {
  const url = new URL(request.url);
  const query = parseAgentExportQuery(url);

  const rows = await loadAgentExportRows(user, query);

  const csv = toCsv(HEADERS, rows);

  await auditExport(
    user,
    'agents.csv',
    {
      status: query.status ?? null,
      type: query.type ?? null,
      regionId: query.regionId ?? null,
      ids: query.ids ?? null,
    },
    rows.length,
  );

  const filename = `agents-${csvTimestampSuffix()}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
});
