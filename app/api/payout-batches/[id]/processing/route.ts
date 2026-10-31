import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseBatchIdParam } from '@/lib/validation/payout-batch';
import { markBatchProcessing } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payout-batches/[id]/processing
 * Admin-only. APPROVED -> PROCESSING.
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const batchId = parseBatchIdParam(id);
    const updated = await markBatchProcessing(user, batchId);
    return ok(updated);
  },
);
