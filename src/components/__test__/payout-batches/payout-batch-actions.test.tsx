// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { PayoutBatchActions } from '../../payout-batches/payout-batch-actions';
import type { PayoutBatchView } from '@/services/payout-batch.service';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeBatch(overrides: Partial<PayoutBatchView> = {}): PayoutBatchView {
  return {
    id: 'b1abc',
    agentId: 'a1',
    period: '2026-09',
    commissionIds: ['c1', 'c2'],
    totalAmount: { amount: 6000, currency: 'XAF' },
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

describe('PayoutBatchActions', () => {
  it('renders Approve and Mark as failed for a DRAFT batch', () => {
    render(
      <ToastProvider>
        <PayoutBatchActions batch={makeBatch({ status: 'DRAFT' })} />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Approve batch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as failed' })).toBeInTheDocument();
  });

  it('renders Mark as processing and Mark as paid for an APPROVED batch', () => {
    render(
      <ToastProvider>
        <PayoutBatchActions batch={makeBatch({ status: 'APPROVED' })} />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Mark as processing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument();
  });

  it('renders nothing for a PAID batch', () => {
    const { container } = render(
      <ToastProvider>
        <PayoutBatchActions batch={makeBatch({ status: 'PAID' })} />
      </ToastProvider>,
    );
    // The component renders nothing (ToastProvider still renders an empty notification container)
    expect(
      screen.queryByRole('button', { name: /Mark as paid|Mark as failed|Approve batch/ }),
    ).not.toBeInTheDocument();
  });
});
