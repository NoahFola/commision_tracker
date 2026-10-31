import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCreateBatchBody, parseListBatchesQuery } from '@/lib/validation/payout-batch';
import { createBatch, listBatches } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payout-batches
 * Admin-only. Creates a DRAFT batch from every eligible APPROVED
 * commission for one agent and one period.
 */
export const POST = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const raw = await request.json().catch(() => {
    throw new BadRequestError('Invalid JSON body');
  });
  const body = parseCreateBatchBody(raw);
  const created = await createBatch(user, body);
  return ok(created, { status: 201 });
});

/**
 * GET /api/payout-batches
 * Admin: all batches; agent: their own only.
 * Query: page, limit, agentId, status, period.
 */
export const GET = withAuth(
  ['ADMIN', 'AGENT'],
  async (request, _context, user): Promise<NextResponse> => {
    const url = new URL(request.url);
    const query = parseListBatchesQuery(url);
    const page = await listBatches(user, query);
    return ok(page);
  },
);
