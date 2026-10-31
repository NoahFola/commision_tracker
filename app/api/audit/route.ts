import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseListAuditQuery } from '@/lib/validation/audit';
import { listAuditRows } from '@/services/audit.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit?entityType=Agent&entityId=<id>&page=&limit=
 * Admin-only. Returns audit rows for one entity, newest first.
 */
export const GET = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const url = new URL(request.url);
  const query = parseListAuditQuery(url);
  const page = await listAuditRows(user, query);
  return ok(page);
});
