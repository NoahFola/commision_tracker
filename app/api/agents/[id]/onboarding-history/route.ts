import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseAgentIdParam } from '@/lib/validation/agent';
import { getOnboardingHistory } from '@/services/agent.service';
import { ok } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/onboarding-history
 * Admin-only. Returns the sequence of onboarding stage transitions for
 * one agent, in chronological order.
 */
export const GET = withAuth<{ id: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const agentId = parseAgentIdParam(id);
    const history = await getOnboardingHistory(user, agentId);
    return ok(history);
  },
);
