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
import AdminDashboardPage from '../page';

const hasTestDb = Boolean(process.env.MONGODB_URI);

afterEach(() => cleanup());

describe.skipIf(!hasTestDb)('admin dashboard page', () => {
  it('renders the four main sections', async () => {
    const ui = await AdminDashboardPage();
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Unpaid commissions awaiting action')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payout batches' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agents needing attention' })).toBeInTheDocument();
  });

  it('renders the two primary actions', async () => {
    const ui = await AdminDashboardPage();
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByRole('link', { name: 'New agent' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New commission' })).toBeInTheDocument();
  });
});
