// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

let mockPush = vi.fn();
let mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: mockRefresh,
  }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { CommissionReverseDialog } from '../../commissions/commission-reverse-dialog';
import type { CommissionView } from '@/services/commission.service';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeCommission(overrides: Partial<CommissionView> = {}): CommissionView {
  return {
    id: 'c1abc123',
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
    status: 'APPROVED',
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

describe('CommissionReverseDialog', () => {
  beforeEach(() => {
    mockPush = vi.fn();
    mockRefresh = vi.fn();
  });

  it('renders the Reverse trigger when enabled', () => {
    render(
      <ToastProvider>
        <CommissionReverseDialog commission={makeCommission()} />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Reverse' })).toBeEnabled();
  });

  it('renders a disabled trigger when disabled', () => {
    render(
      <ToastProvider>
        <CommissionReverseDialog commission={makeCommission({ status: 'PAID' })} disabled />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Reverse' })).toBeDisabled();
  });

  it('opens the dialog and shows the required fields', () => {
    render(
      <ToastProvider>
        <CommissionReverseDialog commission={makeCommission()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(screen.getByLabelText('Reason (required)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Type CM-/i)).toBeInTheDocument();
  });
});
