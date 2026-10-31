import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { loadPayoutExportRows, auditExport } from '@/services/report.service';
import { toCsv, csvTimestampSuffix } from '@/lib/reports/csv';
import { parseListBatchesQuery } from '@/lib/validation/payout-batch';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'id',
  'agentId',
  'period',
  'status',
  'method',
  'commissionCount',
  'totalAmount',
  'currency',
  'paymentReference',
  'createdAt',
  'approvedAt',
  'paidAt',
] as const;

/**
 * GET /api/reports/payouts.csv
 * Admin-only. Returns the filtered set as CSV. Same query params as
 * GET /api/payout-batches.
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user) => {
  const url = new URL(request.url);
  const query = parseListBatchesQuery(url);

  const rows = await loadPayoutExportRows(user, {
    agentId: query.agentId,
    status: query.status,
    period: query.period,
  });

  const csv = toCsv(HEADERS, rows);

  await auditExport(
    user,
    'payouts.csv',
    {
      agentId: query.agentId ?? null,
      status: query.status ?? null,
      period: query.period ?? null,
    },
    rows.length,
  );

  const filename = `payouts-${csvTimestampSuffix()}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
});