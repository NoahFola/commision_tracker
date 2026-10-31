// @vitest-environment happy-dom

vi.mock('@/lib/auth/session-server', () => ({
  requireAdmin: async () => ({
    subjectType: 'ADMIN',
    subjectId: 'test-admin',
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
  }),
  requireSessionUser: async () => ({
    subjectType: 'ADMIN',
    subjectId: 'test-admin',
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
  }),
  getSessionUser: async () => ({
    subjectType: 'ADMIN',
    subjectId: 'test-admin',
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
  }),
}));

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: () => {},
    push: () => {},
    back: () => {},
    refresh: () => {},
  }),
}));

import { ToastProvider } from '@/components';
import NewAgentPage from '../page';

const hasTestDb = Boolean(process.env.MONGODB_URI);

afterEach(() => cleanup());

describe.skipIf(!hasTestDb)('new agent page', () => {
  it('renders the create form with the correct title and action', async () => {
    const ui = await NewAgentPage();
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByRole('heading', { name: 'New agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create agent' })).toBeInTheDocument();
    expect(screen.getByText(/When you create/i)).toBeInTheDocument();
  });
});
