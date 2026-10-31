import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCommissionIdParam } from '@/lib/validation/commission';
import { getCommission } from '@/services/commission.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/[id]
 * Admin: any commission. Agent: only their own (403 otherwise).
 */
export const GET = withAuth<{ id: string }>(
  ['ADMIN', 'AGENT'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const commissionId = parseCommissionIdParam(id);
    const doc = await getCommission(user, commissionId);
    return ok(doc);
  },
);