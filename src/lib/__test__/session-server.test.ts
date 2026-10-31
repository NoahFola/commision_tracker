// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthMeAdmin, AuthMeAgent } from '@/types/auth';

let mockUser: AuthMeAdmin | AuthMeAgent | null = null;
vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: async () => mockUser,
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'epsihome_session' ? { name, value: 'x' } : undefined,
    getAll: () => [{ name: 'epsihome_session', value: 'x' }],
  }),
}));

import { requireAdmin, requireSessionUser } from '@/lib/auth/session-server';

describe('session-server', () => {
  beforeEach(() => {
    mockUser = null;
  });

  it('requireSessionUser redirects to /login when unauthenticated', async () => {
    await expect(requireSessionUser()).rejects.toThrow('redirect:/login');
  });

  it('requireAdmin redirects unauthenticated callers to /login', async () => {
    await expect(requireAdmin()).rejects.toThrow('redirect:/login');
  });

  it('requireAdmin redirects authenticated agents to /', async () => {
    mockUser = {
      subjectType: 'AGENT',
      subjectId: 'x',
      email: 'a@b.cm',
      name: 'A',
      profilePictureUrl: null,
      roles: ['AGENT'],
      agentId: 'x',
      agentType: 'AGENT',
      referralCode: 'A01',
    };
    await expect(requireAdmin()).rejects.toThrow('redirect:/');
  });

  it('requireAdmin returns the admin when authorized', async () => {
    mockUser = {
      subjectType: 'ADMIN',
      subjectId: 'x',
      email: 'a@b.cm',
      name: 'Ops',
      profilePictureUrl: null,
      roles: ['ADMIN'],
    };
    const user = await requireAdmin();
    expect(user.subjectType).toBe('ADMIN');
  });
});