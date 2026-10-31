import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCommissionIdParam, parseReverseCommissionBody } from '@/lib/validation/commission';
import { reverseCommission } from '@/services/commission.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/[id]/reverse
 * Admin-only. Creates a mirror commission that undoes the given one.
 * Body: { reason: string } (required).
 *
 * The original is NOT modified. The mirror is a PENDING commission that
 * must itself be verified and approved before it can be paid.
 */
export const POST = withAuth<{ id: string }>(
  ['ADMIN'],
  async (request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const commissionId = parseCommissionIdParam(id);
    const raw = await request.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });
    const { reason } = parseReverseCommissionBody(raw);
    const mirror = await reverseCommission(user, commissionId, reason);
    return ok(mirror, { status: 201 });
  },
);
