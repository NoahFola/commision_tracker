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
import { CommissionForm } from '../../commissions/commission-form';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const agents = [
  { id: 'a1', fullName: 'Awa Ngwa', type: 'AGENT' as const, region: 'Douala', commissionRate: 500 },
  {
    id: 'a2',
    fullName: 'Bello Nkeng',
    type: 'AMBASSADOR' as const,
    region: 'Yaoundé',
    commissionRate: 800,
  },
];

function renderForm() {
  return render(
    <ToastProvider>
      <CommissionForm agents={agents} />
    </ToastProvider>,
  );
}

describe('CommissionForm', () => {
  beforeEach(() => {
    mockReplace = vi.fn();
    mockBack = vi.fn();
    mockRefresh = vi.fn();
  });

  it('renders all fields and the info banner', () => {
    renderForm();
    expect(screen.getByLabelText('Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
    expect(screen.getByLabelText('First payment confirmed')).toBeInTheDocument();
    expect(screen.getByLabelText('Base amount')).toBeInTheDocument();
    expect(screen.getByText(/Created as Pending/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create commission' })).toBeInTheDocument();
  });

  it('shows the preview once agent and base amount are set', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('Base amount'), { target: { value: '20000' } });
    await waitFor(() => {
      expect(screen.getByText('How the amount is worked out')).toBeInTheDocument();
    });
    // 5% of 20,000 = 1,000 gross; 5% fee = 50; net = 950.
    expect(
      screen.getAllByText((_content, element) => element?.textContent === '1,000 XAF')[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((_content, element) => element?.textContent === '950 XAF')[0],
    ).toBeInTheDocument();
  });

  it('shows client validation errors and does not submit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create commission' }));
    await waitFor(() => {
      expect(screen.getByText(/fields? need(s)? fixing/)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submits to POST /api/commissions and redirects on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: 'c1',
            period: '2026-09',
            netAmount: { amount: 950, currency: 'XAF' },
          },
        }),
        { status: 201 },
      ) as unknown as Response,
    );

    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('Customer ID'), {
      target: { value: 'CUST-001' },
    });
    fireEvent.change(screen.getByLabelText('Base amount'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create commission' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/commissions');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.agentId).toBe('a1');
    expect(body.coreCustomerId).toBe('CUST-001');
    expect(body.baseAmount).toEqual({ amount: 20000, currency: 'XAF' });
    expect(body.firstPaymentConfirmedAt).toMatch(/T\d{2}:\d{2}:00\.000Z$/);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/admin/commissions');
    });
  });

  it('shows the server error on 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: 'CONFLICT',
            message: 'A commission already exists for this agent, customer, and period',
          },
        }),
        { status: 409 },
      ) as unknown as Response,
    );

    renderForm();
    fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('Customer ID'), {
      target: { value: 'CUST-001' },
    });
    fireEvent.change(screen.getByLabelText('Base amount'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create commission' }));

    await waitFor(() => {
      expect(screen.getByText(/A commission already exists/)).toBeInTheDocument();
    });
  });
});
