import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseAgentIdParam, parseUpdateAgentBody } from '@/lib/validation/agent';
import { deleteAgent, getAgent, updateAgent } from '@/services/agent.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const agentId = parseAgentIdParam(id);
    const agent = await getAgent(user, agentId);
    return ok(agent);
  },
);

export const PATCH = withAuth<{ id: string }>(
  ['ADMIN'],
  async (request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const agentId = parseAgentIdParam(id);
    const raw = await request.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });
    const body = parseUpdateAgentBody(raw);
    const updated = await updateAgent(user, agentId, body);
    return ok(updated);
  },
);

/**
 * DELETE /api/agents/[id]
 * Soft-delete semantics: sets status to TERMINATED. No document is removed.
 * Idempotent — repeating the request on a terminated agent is a no-op.
 * Returns 200 with the updated AgentDetail (not 204) so the UI can refresh
 * from the response alone.
 */
export const DELETE = withAuth<{ id: string }>(
  ['ADMIN'],
  async (_request, context, user): Promise<NextResponse> => {
    const { id } = await context.params;
    const agentId = parseAgentIdParam(id);
    const terminated = await deleteAgent(user, agentId);
    return ok(terminated);
  },
);
