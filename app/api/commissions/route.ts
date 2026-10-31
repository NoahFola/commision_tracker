import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCreateCommissionBody, parseListCommissionsQuery } from '@/lib/validation/commission';
import { createCommission, listCommissions } from '@/services/commission.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions
 * Admin-only. Records a commission for a signed customer whose first
 * subscription payment has been confirmed. Idempotent per
 * (agentId, coreCustomerId, period) — duplicate -> 409.
 */
export const POST = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const raw = await request.json().catch(() => {
    throw new BadRequestError('Invalid JSON body');
  });
  const body = parseCreateCommissionBody(raw);
  const created = await createCommission(user, body);
  return ok(created, { status: 201 });
});

/**
 * GET /api/commissions
 * Admin: all agents, filterable by ?agentId=. Agent: own rows only.
 * Query: page, limit, agentId, status, period.
 */
export const GET = withAuth(
  ['ADMIN', 'AGENT'],
  async (request, _context, user): Promise<NextResponse> => {
    const url = new URL(request.url);
    const query = parseListCommissionsQuery(url);
    const page = await listCommissions(user, query);
    return ok(page);
  },
);
