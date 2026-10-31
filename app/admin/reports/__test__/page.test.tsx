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
}));

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/reports',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: () => {},
    push: () => {},
    back: () => {},
    refresh: () => {},
  }),
}));

import { ToastProvider } from '@/components';
import ReportsPage from '../page';

const hasTestDb = Boolean(process.env.MONGODB_URI);

afterEach(() => cleanup());

describe.skipIf(!hasTestDb)('reports page', () => {
  it('renders the title, CSV links, and group-by selector', async () => {
    const ui = await ReportsPage({ searchParams: Promise.resolve({ period: '2026-09' }) });
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByRole('heading', { name: 'Monthly summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'commissions.csv' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'payouts.csv' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'By agent' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'By region' })).toBeInTheDocument();
  });

  it('renders the print view when ?print=1', async () => {
    const ui = await ReportsPage({
      searchParams: Promise.resolve({ period: '2026-09', print: '1' }),
    });
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByText(/Monthly summary ·/)).toBeInTheDocument();
    // Print mode does not render the PageShell title
    expect(screen.queryByRole('heading', { name: 'Monthly summary' })).not.toBeInTheDocument();
  });
});
