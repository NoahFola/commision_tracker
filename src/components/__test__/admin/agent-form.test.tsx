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
import { AgentForm } from '../../admin/agent-form';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const regions = [
  { id: 'r1', name: 'Douala' },
  { id: 'r2', name: 'Yaoundé' },
];

function renderForm(props: React.ComponentProps<typeof AgentForm>) {
  return render(
    <ToastProvider>
      <AgentForm {...props} />
    </ToastProvider>,
  );
}

describe('AgentForm — create mode', () => {
  beforeEach(() => {
    mockReplace = vi.fn();
    mockBack = vi.fn();
    mockRefresh = vi.fn();
  });

  it('renders all sections and the temporary password field', () => {
    renderForm({ mode: 'create', regions });
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Contact and sign-in')).toBeInTheDocument();
    expect(screen.getByText('Payout preference')).toBeInTheDocument();
    expect(screen.getByText('Starting status')).toBeInTheDocument();
    expect(screen.getByLabelText('Temporary password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create agent' })).toBeInTheDocument();
  });

  it('shows client validation errors and does not hit the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderForm({ mode: 'create', regions });
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    await waitFor(() => {
      expect(screen.getByText(/fields? need(s)? fixing/)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submits to POST /api/agents and navigates on success', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { id: 'new-agent-id', fullName: 'X' } }), {
          status: 201,
        }) as unknown as Response,
      );

    renderForm({ mode: 'create', regions });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Awa' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.cm' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+237677000000' } });
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'r1' } });
    fireEvent.change(screen.getByLabelText('Referral code'), { target: { value: 'AWA01' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), {
      target: { value: 'a-very-strong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/agents');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.password).toBe('a-very-strong-password');
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/admin/agents/new-agent-id');
    });
  });

  it('shows a server error banner when the API rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'CONFLICT', message: 'email is already in use' },
        }),
        { status: 409 },
      ) as unknown as Response,
    );

    renderForm({ mode: 'create', regions });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Awa' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.cm' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+237677000000' } });
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'r1' } });
    fireEvent.change(screen.getByLabelText('Referral code'), { target: { value: 'AWA01' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), {
      target: { value: 'a-very-strong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
    await waitFor(() => {
      expect(screen.getByText('email is already in use')).toBeInTheDocument();
    });
  });
});

describe('AgentForm — edit mode', () => {
  beforeEach(() => {
    mockReplace = vi.fn();
    mockBack = vi.fn();
    mockRefresh = vi.fn();
  });

  it('renders without the password field and with current values', () => {
    renderForm({
      mode: 'edit',
      agentId: 'a1',
      regions,
      initialValues: {
        fullName: 'Awa Ngwa',
        email: 'awa@example.cm',
        phone: '+237600000000',
        referralCode: 'AWA01',
        regionId: 'r1',
        type: 'AGENT',
        status: 'ACTIVE',
        onboardingStage: 'REGISTERED',
        payoutMethod: 'MOBILE_MONEY',
        payoutProvider: 'MTN MoMo',
        payoutAccountNumber: '677000000',
        payoutAccountName: 'Awa Ngwa',
      },
    });
    expect(screen.queryByLabelText('Temporary password')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Awa Ngwa');
    expect(screen.getByLabelText('Email')).toHaveValue('awa@example.cm');
    expect(screen.getByLabelText('Provider')).toHaveValue('MTN MoMo');
  });

  it('submits to PATCH /api/agents/[id] and does not navigate away', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { id: 'a1' } }), {
          status: 200,
        }) as unknown as Response,
      );

    renderForm({
      mode: 'edit',
      agentId: 'a1',
      regions,
      initialValues: {
        fullName: 'Awa Ngwa',
        email: 'awa@example.cm',
        phone: '+237600000000',
        referralCode: 'AWA01',
        regionId: 'r1',
        type: 'AGENT',
        payoutMethod: 'MOBILE_MONEY',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/agents/a1');
    expect((init as RequestInit).method).toBe('PATCH');
    await waitFor(() => {
      expect(screen.getByText('Changes saved')).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
