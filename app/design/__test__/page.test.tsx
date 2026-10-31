// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ToastProvider } from '@/components';
import type { AuthMeAdmin, AuthMeAgent } from '@/types/auth';

let mockUser: AuthMeAdmin | AuthMeAgent | null = null;
vi.mock('@/lib/auth/session-server', () => ({
  requireSessionUser: async () => {
    if (!mockUser) throw new Error('no user');
    return mockUser;
  },
  getSessionUser: async () => mockUser,
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error('not-found');
  },
}));

afterEach(() => cleanup());

import DesignPage from '../page';

describe('design reference page', () => {
  beforeEach(() => {
    mockUser = null;
  });

  it('404s for a non-admin', async () => {
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
    await expect(DesignPage()).rejects.toThrow('not-found');
  });

  it('renders for an admin', async () => {
    mockUser = {
      subjectType: 'ADMIN',
      subjectId: 'x',
      email: 'a@b.cm',
      name: 'Ops',
      profilePictureUrl: null,
      roles: ['ADMIN'],
    };
    const ui = await DesignPage();
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByText(/Design reference/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent statuses/i)).toBeInTheDocument();
  });
});
