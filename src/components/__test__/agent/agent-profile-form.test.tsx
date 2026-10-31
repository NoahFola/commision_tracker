// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { ToastProvider } from '@/components/ui-states/toast-provider';
import { AgentProfileForm } from '@/components/agent/agent-profile-form';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AgentProfileForm', () => {
  it('renders the current values', () => {
    render(
      <ToastProvider>
        <AgentProfileForm
          initialPhone="+237677000000"
          initialPayoutPreference={{
            method: 'MOBILE_MONEY',
            provider: 'MTN MoMo',
            accountNumber: '677000000',
            accountName: 'Awa Ngwa',
          }}
        />
      </ToastProvider>,
    );
    expect(screen.getByLabelText('Phone')).toHaveValue('+237677000000');
    expect(screen.getByLabelText('Provider')).toHaveValue('MTN MoMo');
    expect(screen.getByLabelText('Account number')).toHaveValue('677000000');
  });

  it('submits to PATCH /api/agents/me', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })) as unknown as Response);
    render(
      <ToastProvider>
        <AgentProfileForm
          initialPhone="+237677000000"
          initialPayoutPreference={{
            method: 'MOBILE_MONEY',
            provider: 'MTN MoMo',
            accountNumber: '677000000',
            accountName: 'Awa Ngwa',
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/agents/me');
    expect((init as RequestInit).method).toBe('PATCH');
  });
});
