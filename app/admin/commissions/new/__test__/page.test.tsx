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
import NewCommissionPage from '../page';

const hasTestDb = Boolean(process.env.MONGODB_URI);

afterEach(() => cleanup());

describe.skipIf(!hasTestDb)('new commission page', () => {
  it('renders the form with the correct title and action', async () => {
    const ui = await NewCommissionPage();
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByRole('heading', { name: 'New commission' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create commission' })).toBeInTheDocument();
    expect(screen.getByLabelText('Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('First payment confirmed')).toBeInTheDocument();
    expect(screen.getByLabelText('Base amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
  });

  it('renders the period field as read-only', async () => {
    const ui = await NewCommissionPage();
    render(<ToastProvider>{ui}</ToastProvider>);
    const period = screen.getByLabelText('Period') as HTMLInputElement;
    expect(period.disabled).toBe(true);
  });
});
