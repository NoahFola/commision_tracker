// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

let mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: mockRefresh,
  }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { PayoutBatchRemoveDialog } from '../../payout-batches/payout-batch-remove-dialog';
import type { PayoutBatchView } from '@/services/payout-batch.service';
import type { CommissionView } from '@/services/commission.service';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeBatch(overrides: Partial<PayoutBatchView> = {}): PayoutBatchView {
  return {
    id: 'b1abcd',
    agentId: 'a1',
    period: '2026-09',
    commissionIds: ['c1', 'c2'],
    totalAmount: { amount: 15700, currency: 'XAF' },
    status: 'DRAFT',
    method: 'MOBILE_MONEY',
    paymentReference: null,
    createdBy: 'admin1',
    approvedBy: null,
    approvedAt: null,
    paidBy: null,
    paidAt: null,
    failedAt: null,
    failureReason: null,
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeCommission(overrides: Partial<CommissionView> = {}): CommissionView {
  return {
    id: 'c1abcd',
    agentId: 'a1',
    coreCustomerId: 'CUST-0333',
    firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
    period: '2026-09',
    baseAmount: { amount: 20000, currency: 'XAF' },
    rateApplied: 500,
    platformFeeRateApplied: 500,
    grossAmount: { amount: 1000, currency: 'XAF' },
    platformFee: { amount: 50, currency: 'XAF' },
    netAmount: { amount: 950, currency: 'XAF' },
    status: 'APPROVED',
    verifiedBy: null,
    verifiedAt: null,
    approvedBy: null,
    approvedAt: null,
    paidBy: null,
    paidAt: null,
    payoutBatchId: 'b1abcd',
    reversesCommissionId: null,
    reason: null,
    createdBy: 'admin1',
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('PayoutBatchRemoveDialog', () => {
  beforeEach(() => {
    mockRefresh = vi.fn();
  });

  it('renders the Remove trigger', () => {
    render(
      <ToastProvider>
        <PayoutBatchRemoveDialog batch={makeBatch()} commission={makeCommission()} />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('opens the dialog with totals and no warning when above minimum', async () => {
    render(
      <ToastProvider>
        <PayoutBatchRemoveDialog batch={makeBatch()} commission={makeCommission()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(screen.getByText(/Remove CM-/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/below the 5,000 XAF minimum/)).not.toBeInTheDocument();
  });

  it('shows the below-minimum warning when removal would drop below 5,000', async () => {
    // Batch 5,700 with one 3,800 commission: removing it leaves 1,900.
    render(
      <ToastProvider>
        <PayoutBatchRemoveDialog
          batch={makeBatch({ totalAmount: { amount: 5700, currency: 'XAF' } })}
          commission={makeCommission({ netAmount: { amount: 3800, currency: 'XAF' } })}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(screen.getByText(/below the 5,000 XAF minimum/)).toBeInTheDocument();
    });
  });
});
