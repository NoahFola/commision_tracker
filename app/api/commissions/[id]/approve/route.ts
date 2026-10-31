import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCommissionIdParam } from '@/lib/validation/commission';
import { approveCommission } from '@/services/commission.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/[id]/approve
 * Admin-only. VERIFIED -> APPROVED. Records the approving admin and time.
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const commissionId = parseCommissionIdParam(id);
    const doc = await approveCommission(user, commissionId);
    return ok(doc);
  },
);
