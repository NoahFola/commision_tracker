import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCommissionIdParam } from '@/lib/validation/commission';
import { verifyCommission } from '@/services/commission.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/[id]/verify
 * Admin-only. PENDING -> VERIFIED. Records the verifying admin and time.
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const commissionId = parseCommissionIdParam(id);
    const doc = await verifyCommission(user, commissionId);
    return ok(doc);
  },
);
