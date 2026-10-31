// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

let mockReplace = vi.fn();
let mockBack = vi.fn();
let mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: mockBack,
    refresh: mockRefresh,
  }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { PayoutBatchForm } from '../../payout-batches/payout-batch-form';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const agents = [{ id: 'a1', fullName: 'Awa Ngwa', type: 'AGENT' as const, region: 'Douala' }];

const agentDetail = {
  id: 'a1',
  fullName: 'Awa Ngwa',
  type: 'AGENT',
  email: 'awa@example.cm',
  phone: '+237600000000',
  status: 'ACTIVE',
  onboardingStage: 'REGISTERED',
  referralCode: 'AWA01',
  dateJoined: '2026-09-15T00:00:00.000Z',
  profilePictureUrl: null,
  payoutPreference: {
    method: 'MOBILE_MONEY',
    provider: 'MTN MoMo',
    accountNumber: '677000000',
    accountName: 'Awa Ngwa',
    isDefault: true,
  },
  region: { id: 'r1', name: 'Douala' },
};

const approvedCommission = {
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
};

function renderForm() {
  return render(
    <ToastProvider>
      <PayoutBatchForm agents={agents} />
    </ToastProvider>,
  );
}

function mockFetches({
  agentOk = true,
  commissions = [] as unknown[],
  batches = [] as unknown[],
  commissionsOk = true,
  batchesOk = true,
} = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/agents/') && url !== '/api/agents/a1/') {
      return new Response(
        JSON.stringify(
          agentOk
            ? { ok: true, data: agentDetail }
            : { ok: false, error: { message: 'not found' } },
        ),
      ) as unknown as Response;
    }
    if (url.startsWith('/api/agents/')) {
      return new Response(
        JSON.stringify(
          agentOk
            ? { ok: true, data: agentDetail }
            : { ok: false, error: { message: 'not found' } },
        ),
      ) as unknown as Response;
    }
    if (url.startsWith('/api/commissions')) {
      return new Response(
        JSON.stringify(
          commissionsOk
            ? { ok: true, data: { items: commissions, total: commissions.length } }
            : { ok: false, error: { message: 'commissions error' } },
        ),
      ) as unknown as Response;
    }
    if (url.startsWith('/api/payout-batches')) {
      return new Response(
        JSON.stringify(
          batchesOk
            ? { ok: true, data: { items: batches, total: batches.length } }
            : { ok: false, error: { message: 'batches error' } },
        ),
      ) as unknown as Response;
    }
    return new Response('{}') as unknown as Response;
  });
}

describe('PayoutBatchForm', () => {
  beforeEach(() => {
    mockReplace = vi.fn();
    mockBack = vi.fn();
    mockRefresh = vi.fn();
  });

  it('renders all fields', () => {
    renderForm();
    expect(screen.getByLabelText('Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
    expect(screen.getByLabelText('Method')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create batch' })).toBeInTheDocument();
  });

  it('populates the method from the agent detail after selection', async () => {
    mockFetches();
    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    await waitFor(() => {
      expect(screen.getByLabelText('Method')).not.toBeDisabled();
    });
  });

  it('shows the below-minimum banner when the total is under 5000', async () => {
    mockFetches({ commissions: [approvedCommission] });
    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '2026-09' } });
    await waitFor(() => {
      expect(screen.getByText(/below the 5,000 XAF minimum/)).toBeInTheDocument();
    });
  });

  it('shows the above-minimum banner when the total exceeds 5000', async () => {
    const commissions = Array.from({ length: 6 }, (_, i) => ({
      ...approvedCommission,
      id: `c${i}`,
    }));
    mockFetches({ commissions });
    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '2026-09' } });
    await waitFor(() => {
      expect(screen.getByText(/above the 5,000 XAF minimum/)).toBeInTheDocument();
    });
  });

  it('shows the existing-batch block when there is a non-terminal batch', async () => {
    mockFetches({
      commissions: Array.from({ length: 6 }, (_, i) => ({ ...approvedCommission, id: `c${i}` })),
      batches: [
        {
          id: 'b1xyz',
          agentId: 'a1',
          period: '2026-09',
          commissionIds: [],
          totalAmount: { amount: 6000, currency: 'XAF' },
          status: 'PROCESSING',
          method: 'MOBILE_MONEY',
          paymentReference: null,
          createdBy: 'a',
          approvedBy: null,
          approvedAt: null,
          paidBy: null,
          paidAt: null,
          failedAt: null,
          failureReason: null,
          createdAt: '2026-09-15T10:00:00.000Z',
          updatedAt: '2026-09-15T10:00:00.000Z',
        },
      ],
    });
    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '2026-09' } });
    await waitFor(() => {
      expect(screen.getByText(/A batch already exists/)).toBeInTheDocument();
    });
  });
});
