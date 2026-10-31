// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AgentHeader } from '../admin/agent-header';
import type { AgentDetail } from '@/types/agent';

afterEach(() => cleanup());

const baseAgent: AgentDetail = {
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
  payoutPreference: { method: 'MOBILE_MONEY', isDefault: true },
  region: { id: 'r1', name: 'Douala' },
};

describe('AgentHeader', () => {
  it('renders the name, type, status, region and referral code', () => {
    render(<AgentHeader agent={baseAgent} actions={<button>Suspend</button>} />);
    expect(screen.getByRole('heading', { name: 'Awa Ngwa' })).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/Douala/)).toBeInTheDocument();
    expect(screen.getByText('AWA01')).toBeInTheDocument();
  });

  it('renders an ambassador as "Ambassador"', () => {
    render(
      <AgentHeader
        agent={{ ...baseAgent, type: 'AMBASSADOR' }}
        actions={<button>Suspend</button>}
      />,
    );
    expect(screen.getByText('Ambassador')).toBeInTheDocument();
  });

  it('renders the supplied action slot', () => {
    render(<AgentHeader agent={baseAgent} actions={<button>Custom action</button>} />);
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeInTheDocument();
  });
});