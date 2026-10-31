import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { loadCommissionExportRows, auditExport } from '@/services/report.service';
import { toCsv, csvTimestampSuffix } from '@/lib/reports/csv';
import { parseListCommissionsQuery } from '@/lib/validation/commission';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'id',
  'agentId',
  'coreCustomerId',
  'period',
  'status',
  'baseAmount',
  'grossAmount',
  'platformFee',
  'netAmount',
  'currency',
  'rateApplied',
  'createdAt',
  'paidAt',
] as const;

/**
 * GET /api/reports/commissions.csv
 * Admin-only. Returns the filtered set as CSV. Same query params as
 * GET /api/commissions.
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user) => {
  const url = new URL(request.url);
  const query = parseListCommissionsQuery(url);

  const rows = await loadCommissionExportRows(user, {
    agentId: query.agentId,
    status: query.status,
    period: query.period,
  });

  const csv = toCsv(HEADERS, rows);

  await auditExport(
    user,
    'commissions.csv',
    {
      agentId: query.agentId ?? null,
      status: query.status ?? null,
      period: query.period ?? null,
    },
    rows.length,
  );

  const filename = `commissions-${csvTimestampSuffix()}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
});