// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/agents',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: () => {},
    push: () => {},
    refresh: () => {},
    back: () => {},
  }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { AgentTable } from '../../admin/agent-table';
import type { AgentListItem } from '@/types/agent';

afterEach(() => cleanup());

function makeAgent(overrides: Partial<AgentListItem> = {}): AgentListItem {
  return {
    id: 'a1',
    fullName: 'Awa Ngwa',
    type: 'AGENT',
    email: 'awa@example.cm',
    phone: '+237600000000',
    status: 'ACTIVE',
    onboardingStage: 'REGISTERED',
    referralCode: 'AWA01',
    commissionRate: 500, // ← add this line
    dateJoined: '2026-09-15T00:00:00.000Z',
    region: { id: 'r1', name: 'Douala' },
    ...overrides,
  };
}

function renderTable(agents: AgentListItem[]) {
  return render(
    <ToastProvider>
      <AgentTable agents={agents} />
    </ToastProvider>,
  );
}

describe('AgentTable', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('renders one row per agent with the documented columns', () => {
    renderTable([makeAgent({ id: 'a1' }), makeAgent({ id: 'a2', fullName: 'Bello' })]);
    expect(screen.getByText('Awa Ngwa')).toBeInTheDocument();
    expect(screen.getByText('Bello')).toBeInTheDocument();
    expect(screen.getAllByText('Douala')).toHaveLength(2);
  });

  it('links the name cell to the detail page', () => {
    renderTable([makeAgent({ id: 'xyz' })]);
    const link = screen.getByRole('link', { name: 'Awa Ngwa' });
    expect(link).toHaveAttribute('href', '/admin/agents/xyz');
  });

  it('renders the status badge and onboarding indicator', () => {
    renderTable([makeAgent({ status: 'SUSPENDED', onboardingStage: 'VERIFIED' })]);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText(/Verified · step 3 of 4/)).toBeInTheDocument();
  });

  it('toggles a single row on checkbox click', () => {
    renderTable([makeAgent({ id: 'a1' }), makeAgent({ id: 'a2', fullName: 'B' })]);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]!);
    expect(checkboxes[1]).toBeChecked();
    expect(screen.getByText('1 selected on this page')).toBeInTheDocument();
  });

  it('select all toggles every row', () => {
    renderTable([makeAgent({ id: 'a1' }), makeAgent({ id: 'a2', fullName: 'B' })]);
    const selectAll = screen.getByRole('checkbox', { name: /Select all/ });
    fireEvent.click(selectAll);
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) expect(cb).toBeChecked();
    expect(screen.getByText('2 selected on this page')).toBeInTheDocument();
  });

  it('clear selection empties the selection', () => {
    renderTable([makeAgent({ id: 'a1' })]);
    const rowCheckbox = screen.getAllByRole('checkbox')[1]!;
    fireEvent.click(rowCheckbox);
    expect(screen.getByText('1 selected on this page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear selection/ }));
    expect(screen.queryByText(/selected on this page/)).not.toBeInTheDocument();
  });

  it('exports the selected ids as a query string and shows a toast', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    renderTable([makeAgent({ id: 'a1' }), makeAgent({ id: 'a2' })]);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(checkboxes[2]!);
    fireEvent.click(screen.getByRole('button', { name: /Export selected/ }));

    expect(clickSpy).toHaveBeenCalled();
    expect(screen.getByText('2 agents exported')).toBeInTheDocument();
  });
});
