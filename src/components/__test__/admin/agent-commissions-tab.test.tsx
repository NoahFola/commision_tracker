// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/agents/a1',
  useSearchParams: () => new URLSearchParams('tab=commissions'),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { AgentCommissionsTab } from '../../admin/agent-commissions-tab';
import type { CommissionView } from '@/services/commission.service';

afterEach(() => cleanup());

function makeCommission(overrides: Partial<CommissionView> = {}): CommissionView {
  return {
    id: 'c1',
    agentId: 'a1',
    coreCustomerId: 'CUST-001',
    firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
    period: '2026-09',
    baseAmount: { amount: 20000, currency: 'XAF' },
    rateApplied: 500,
    platformFeeRateApplied: 500,
    grossAmount: { amount: 1000, currency: 'XAF' },
    platformFee: { amount: 50, currency: 'XAF' },
    netAmount: { amount: 950, currency: 'XAF' },
    status: 'PENDING',
    verifiedBy: null,
    verifiedAt: null,
    approvedBy: null,
    approvedAt: null,
    paidBy: null,
    paidAt: null,
    payoutBatchId: null,
    reversesCommissionId: null,
    reason: null,
    createdBy: 'admin1',
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('AgentCommissionsTab', () => {
  it('renders the count, table and export link', () => {
    render(
      <ToastProvider>
        <AgentCommissionsTab agentId="a1" items={[makeCommission()]} total={1} showExport />
      </ToastProvider>,
    );
    expect(screen.getByText('1 commission')).toBeInTheDocument();
    const exportLink = screen.getByRole('link', { name: /Export this view/ });
    expect(exportLink.getAttribute('href')).toContain('agentId=a1');
  });

  it('hides the export link when showExport is false', () => {
    render(
      <ToastProvider>
        <AgentCommissionsTab agentId="a1" items={[]} total={0} showExport={false} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('link', { name: /Export this view/ })).not.toBeInTheDocument();
  });

  it('shows the totals row when there are items', () => {
    render(
      <ToastProvider>
        <AgentCommissionsTab
          agentId="a1"
          items={[makeCommission({ id: 'c1' }), makeCommission({ id: 'c2' })]}
          total={2}
          showExport
        />
      </ToastProvider>,
    );
    expect(screen.getByText(/Totals \(2 rows\)/)).toBeInTheDocument();
  });
});
