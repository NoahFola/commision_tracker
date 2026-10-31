// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AgentHomeHero } from '@/components/agent/agent-home-hero';

afterEach(() => cleanup());

const PREF = {
  method: 'MOBILE_MONEY' as const,
  provider: 'MTN MoMo',
  accountNumber: '677000000',
  accountName: 'Awa Ngwa',
};

describe('AgentHomeHero', () => {
  it('renders the "owed but below minimum" state', () => {
    render(
      <AgentHomeHero
        owedNow={{ amount: 3800, currency: 'XAF' }}
        owedNowCount={1}
        payoutPreference={PREF}
      />,
    );
    expect(screen.getByText(/You need/)).toBeInTheDocument();
    expect(screen.getByText(/more to withdraw/)).toBeInTheDocument();
    expect(screen.getByText(/Payouts start at 5,000/)).toBeInTheDocument();
  });

  it('renders the "ready" state when the total is above 5,000', () => {
    render(
      <AgentHomeHero
        owedNow={{ amount: 15675, currency: 'XAF' }}
        owedNowCount={2}
        payoutPreference={PREF}
      />,
    );
    expect(screen.getByText(/Ready to pay/)).toBeInTheDocument();
    expect(screen.getByText(/Next payout on/)).toBeInTheDocument();
  });

  it('renders the empty state when owedNow is zero', () => {
    render(
      <AgentHomeHero
        owedNow={{ amount: 0, currency: 'XAF' }}
        owedNowCount={0}
        payoutPreference={PREF}
      />,
    );
    expect(screen.getByText(/no approved earnings yet/)).toBeInTheDocument();
  });
});
