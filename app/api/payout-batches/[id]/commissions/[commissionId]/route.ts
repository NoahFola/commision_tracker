import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseBatchIdParam } from '@/lib/validation/payout-batch';
import { removeCommissionFromBatch } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/payout-batches/[id]/commissions/[commissionId]
 * Admin-only. Removes one commission from a DRAFT batch.
 */
export const DELETE = withAuth<{ id: string; commissionId: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id, commissionId } = await context.params;
    const batchId = parseBatchIdParam(id);
    if (!Types.ObjectId.isValid(commissionId)) {
      throw new BadRequestError('commissionId is invalid');
    }
    const updated = await removeCommissionFromBatch(user, batchId, commissionId);
    return ok(updated);
  },
);
