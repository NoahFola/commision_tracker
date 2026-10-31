import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { AuthMeAdmin, AuthMeAgent } from '@/types/auth';

vi.mock('../current-user', () => ({
  getCurrentUser: vi.fn(),
}));

import { withAuth } from '../with-auth';
import { getCurrentUser } from '../current-user';

const mockGetCurrentUser = getCurrentUser as unknown as ReturnType<typeof vi.fn>;

const adminUser: AuthMeAdmin = {
  subjectType: 'ADMIN',
  subjectId: 'a1',
  email: 'a@b.cm',
  name: 'Ops',
  profilePictureUrl: null,
  roles: ['ADMIN'],
};

const agentUser: AuthMeAgent = {
  subjectType: 'AGENT',
  referralCode: 'XXX',
  subjectId: 'g1',
  email: 'g@x.cm',
  name: 'G',
  profilePictureUrl: null,
  roles: ['AGENT'],
  agentId: 'g1',
  agentType: 'AGENT',
};

const okHandler = async (_req: Request, _ctx: unknown, user: unknown) =>
  NextResponse.json({ ok: true, data: { user } });

describe('withAuth', () => {
  beforeEach(() => mockGetCurrentUser.mockReset());

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const wrapped = withAuth(['ADMIN'], okHandler as never);
    const res = await wrapped(new Request('http://x/'), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated with the wrong role', async () => {
    mockGetCurrentUser.mockResolvedValue(agentUser);
    const wrapped = withAuth(['ADMIN'], okHandler as never);
    const res = await wrapped(new Request('http://x/'), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it('runs the handler when role matches, and passes the user through', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const wrapped = withAuth(['ADMIN'], okHandler as never);
    const res = await wrapped(new Request('http://x/'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.subjectType).toBe('ADMIN');
  });

  it('passes the context through so dynamic routes can read params', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const seen: { id?: string } = {};
    const handler = async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
      const p = await ctx.params;
      seen.id = p.id;
      return NextResponse.json({ ok: true, data: null });
    };
    const wrapped = withAuth<{ id: string }>(['ADMIN'], handler);
    await wrapped(new Request('http://x/'), { params: Promise.resolve({ id: 'abc' }) });
    expect(seen.id).toBe('abc');
  });

  it('maps thrown AppErrors through toErrorResponse', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const handler = async () => {
      const { NotFoundError } = await import('@/lib/errors/app-error');
      throw new NotFoundError('nope');
    };
    const wrapped = withAuth(['ADMIN'], handler as never);
    const res = await wrapped(new Request('http://x/'), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });
});
