import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseAddCommissionBody, parseBatchIdParam } from '@/lib/validation/payout-batch';
import { addCommissionToBatch } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payout-batches/[id]/commissions
 * Admin-only. Adds one APPROVED commission to a DRAFT batch.
 * Body: { commissionId: string }.
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const batchId = parseBatchIdParam(id);
    const raw = await request.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });
    const { commissionId } = parseAddCommissionBody(raw);
    const updated = await addCommissionToBatch(user, batchId, commissionId);
    return ok(updated);
  },
);
