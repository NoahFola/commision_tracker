import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseBatchIdParam } from '@/lib/validation/payout-batch';
import { getBatch } from '@/services/payout-batch.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  ['ADMIN', 'AGENT'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const batchId = parseBatchIdParam(id);
    const batch = await getBatch(user, batchId);
    return ok(batch);
  },
);
