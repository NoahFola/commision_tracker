// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AgentSummaryTiles } from '@/components/admin/agent-summary-tiles';

afterEach(() => cleanup());

describe('AgentSummaryTiles', () => {
  it('renders all four tiles with amounts and captions', () => {
    render(
      <AgentSummaryTiles
        owedNow={{ amount: 15675, currency: 'XAF' }}
        owedNowCount={2}
        beingChecked={{ amount: 7125, currency: 'XAF' }}
        beingCheckedCount={1}
        paidToDate={{ amount: 22800, currency: 'XAF' }}
        paidToDateCount={2}
        lastPaidAt="2026-09-30T16:40:00.000Z"
        onboardingStage="ONBOARDED"
      />,
    );
    expect(screen.getByText('OWED NOW')).toBeInTheDocument();
    expect(
      screen.getAllByText((_c, el) => el?.textContent === '15,675 XAF')[0],
    ).toBeInTheDocument();
    expect(screen.getByText(/2 approved commissions/)).toBeInTheDocument();
    expect(screen.getByText('BEING CHECKED')).toBeInTheDocument();
    expect(screen.getAllByText((_c, el) => el?.textContent === '7,125 XAF')[0]).toBeInTheDocument();
    expect(screen.getByText('PAID TO DATE')).toBeInTheDocument();
    expect(
      screen.getAllByText((_c, el) => el?.textContent === '22,800 XAF')[0],
    ).toBeInTheDocument();
    expect(screen.getByText('ONBOARDING')).toBeInTheDocument();
    expect(screen.getByText('Onboarded')).toBeInTheDocument();
    expect(screen.getByText(/Step 4 of 4/)).toBeInTheDocument();
  });

  it('shows "No payouts yet" when there is no lastPaidAt', () => {
    render(
      <AgentSummaryTiles
        owedNow={{ amount: 0, currency: 'XAF' }}
        owedNowCount={0}
        beingChecked={{ amount: 0, currency: 'XAF' }}
        beingCheckedCount={0}
        paidToDate={{ amount: 0, currency: 'XAF' }}
        paidToDateCount={0}
        lastPaidAt={null}
        onboardingStage="REGISTERED"
      />,
    );
    expect(screen.getByText('No payouts yet')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
  });

  it('uses singular/plural correctly for counts', () => {
    render(
      <AgentSummaryTiles
        owedNow={{ amount: 0, currency: 'XAF' }}
        owedNowCount={1}
        beingChecked={{ amount: 0, currency: 'XAF' }}
        beingCheckedCount={1}
        paidToDate={{ amount: 0, currency: 'XAF' }}
        paidToDateCount={1}
        lastPaidAt="2026-09-30T00:00:00.000Z"
        onboardingStage="VERIFIED"
      />,
    );
    expect(screen.getByText(/1 approved commission$/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending commission$/)).toBeInTheDocument();
    expect(screen.getByText(/1 payout/)).toBeInTheDocument();
  });
});
