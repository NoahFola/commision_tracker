import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCreateAgentBody, parseListAgentsQuery } from '@/lib/validation/agent';
import { createAgent, listAgents } from '@/services/agent.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

export const GET = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const url = new URL(request.url);
  const query = parseListAgentsQuery(url);
  const page = await listAgents(user, query);
  return ok(page);
});

export const POST = withAuth(['ADMIN'], async (request, _context, user): Promise<NextResponse> => {
  const raw = await request.json().catch(() => {
    throw new BadRequestError('Invalid JSON body');
  });
  const body = parseCreateAgentBody(raw);
  const created = await createAgent(user, body);
  return ok(created, { status: 201 });
});
