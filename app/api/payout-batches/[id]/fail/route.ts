import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseBatchIdParam, parseFailBatchBody } from '@/lib/validation/payout-batch';
import { markBatchFailed } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payout-batches/[id]/fail
 * Admin-only. Any non-terminal -> FAILED. Releases every commission in
 * the batch so a new batch can pick them up. Body: { reason: string }.
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const batchId = parseBatchIdParam(id);
    const raw = await request.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });
    const { reason } = parseFailBatchBody(raw);
    const updated = await markBatchFailed(user, batchId, reason);
    return ok(updated);
  },
);
