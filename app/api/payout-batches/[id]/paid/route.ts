import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseBatchIdParam, parseMarkPaidBody } from '@/lib/validation/payout-batch';
import { markBatchPaid } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payout-batches/[id]/paid
 * Admin-only. APPROVED | PROCESSING -> PAID. Flips every commission in
 * the batch to PAID. Body: { paymentReference?: string } (required for
 * MOBILE_MONEY and BANK, optional for CASH).
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const batchId = parseBatchIdParam(id);
    const raw = await request.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });
    const body = parseMarkPaidBody(raw);
    const updated = await markBatchPaid(user, batchId, body);
    return ok(updated);
  },
);
