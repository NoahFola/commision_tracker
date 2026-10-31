// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { AgentProfileTab } from '../../admin/agent-profile-tab';
import type { AgentDetail } from '@/types/agent';

afterEach(() => cleanup());

const agent: AgentDetail = {
  id: 'a1',
  fullName: 'Awa Ngwa',
  type: 'AGENT',
  email: 'awa@example.cm',
  phone: '+237600000000',
  status: 'ACTIVE',
  onboardingStage: 'VERIFIED',
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

const onboarding = {
  agentId: 'a1',
  currentStage: 'VERIFIED' as const,
  transitions: [],
};

function renderTab(overrides: Partial<AgentDetail> = {}) {
  return render(
    <ToastProvider>
      <AgentProfileTab agent={{ ...agent, ...overrides }} onboarding={onboarding} />
    </ToastProvider>,
  );
}

describe('AgentProfileTab', () => {
  it('renders contact, status, payout preference and terminate sections', () => {
    renderTab();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Status and onboarding')).toBeInTheDocument();
    expect(screen.getByText('Payout preference')).toBeInTheDocument();
    expect(screen.getByText('Terminate agent')).toBeInTheDocument();
    expect(screen.getByText('Awa Ngwa')).toBeInTheDocument();
    expect(screen.getByText('MTN MoMo')).toBeInTheDocument();
    expect(screen.getByText('677000000')).toBeInTheDocument();
  });

  it('shows "This agent is terminated" and hides the terminate action for a terminated agent', () => {
    renderTab({ status: 'TERMINATED' });
    expect(screen.getByText('This agent is terminated.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Terminate/ })).not.toBeInTheDocument();
  });

  it('shows the terminate action for a non-terminated agent', () => {
    renderTab();
    expect(screen.getByRole('button', { name: 'Terminate agent' })).toBeInTheDocument();
  });
});
