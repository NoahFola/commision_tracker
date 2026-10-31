import { NextResponse } from 'next/server';
import { connectDb } from '@/lib/db/mongoose';
import { Agent } from '@/models/agent.model';
import { AgentUser } from '@/models/agent-user.model';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, buildSessionCookie } from '@/lib/auth/session';
import { parseLoginBody, readJsonBody } from '@/lib/validation/auth';
import { ok, toErrorResponse } from '@/lib/errors/respond';
import { UnauthorizedError } from '@/lib/errors/app-error';
import { checkIpLimit, checkFailureLimit, recordFailure } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/ratelimit/request-ip';

export const dynamic = 'force-dynamic';

function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: { code: 'CONFLICT', message: 'Too many attempts. Try again shortly.' },
    },
    { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ip = getClientIp(request);

    const ipLimit = await checkIpLimit(ip);
    if (!ipLimit.success) return tooManyRequests(ipLimit.retryAfterSeconds);

    const body = await readJsonBody(request);
    const { email, password } = parseLoginBody(body);

    const failureLimit = await checkFailureLimit(ip, email);
    if (!failureLimit.success) return tooManyRequests(failureLimit.retryAfterSeconds);

    await connectDb();

    const agentUser = await AgentUser.findOne({ email }).lean<{
      _id: unknown;
      agentId: unknown;
      passwordHash: string;
    }>();
    if (!agentUser) {
      await recordFailure(ip, email);
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await verifyPassword(password, agentUser.passwordHash);
    if (!valid) {
      await recordFailure(ip, email);
      throw new UnauthorizedError('Invalid credentials');
    }

    const agent = await Agent.findById(agentUser.agentId).lean<{
      _id: unknown;
      status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';
    }>();
    if (!agent || agent.status !== 'ACTIVE') {
      await recordFailure(ip, email);
      throw new UnauthorizedError('Invalid credentials');
    }

    const { sessionId, expiresAt } = await createSession({
      type: 'AGENT',
      id: agent._id as unknown as import('mongoose').Types.ObjectId,
    });

    const response = ok({ subjectType: 'AGENT' as const });
    response.headers.append('Set-Cookie', buildSessionCookie(sessionId, expiresAt));
    return response;
  } catch (err) {
    return toErrorResponse(err, undefined);
  }
}
