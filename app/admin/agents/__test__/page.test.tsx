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

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const hasTestDb = Boolean(process.env.MONGODB_URI);

let mockSearchParams: Record<string, string | undefined> = {};
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/agents',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: () => {},
    push: () => {},
    refresh: () => {},
    back: () => {},
  }),
  notFound: () => {
    throw new Error('not-found');
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

import { ToastProvider } from '@/components';
import AgentsPage from '../page';

afterEach(() => cleanup());

describe.skipIf(!hasTestDb)('admin agents list page', () => {
  beforeEach(async () => {
    // The page reads real DB state. We rely on the in-memory MongoDB
    // being empty at this point (it is: the file has no seed step).
    mockSearchParams = {};
  });

  it('renders the empty state when there are no agents', async () => {
    const ui = await AgentsPage({ searchParams: Promise.resolve({}) });
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByText(/No agents yet/)).toBeInTheDocument();
    const newAgentLinks = screen.getAllByRole('link', { name: /New agent/ });
expect(newAgentLinks.length).toBeGreaterThanOrEqual(1);
expect(newAgentLinks[0]).toHaveAttribute('href', '/admin/agents/new');
  });

  it('renders the "New agent" primary action in the top bar', async () => {
    const ui = await AgentsPage({ searchParams: Promise.resolve({}) });
    render(<ToastProvider>{ui}</ToastProvider>);
    const newAgent = screen.getAllByRole('link', { name: /New agent/ });
    expect(newAgent.length).toBeGreaterThanOrEqual(1);
    expect(newAgent[0]).toHaveAttribute('href', '/admin/agents/new');
  });

  it('shows the no-matches empty state when filters are active', async () => {
    const ui = await AgentsPage({
      searchParams: Promise.resolve({ status: 'TERMINATED' }),
    });
    render(<ToastProvider>{ui}</ToastProvider>);
    expect(screen.getByText(/No agents match these filters/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Clear filters/ })).toBeInTheDocument();
  });
});
