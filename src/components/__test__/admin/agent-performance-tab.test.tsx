// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// The chart is a dynamic import; stub it so the tab renders in jsdom.
vi.mock('../performance-chart', () => ({
  default: ({ data }: { data: { periodKey: string; value: number }[] }) => (
    <div data-testid="chart">
      {data.map((d) => (
        <span key={d.periodKey}>
          {d.periodKey}:{d.value}
        </span>
      ))}
    </div>
  ),
}));

import { AgentPerformanceTab } from '../../admin/agent-performance-tab';

afterEach(() => cleanup());

const buckets = [
  {
    periodKey: '2026-08',
    leadsGenerated: 3,
    dealsClosed: 1,
    propertiesReferred: 1,
    landlordsOnboarded: 0,
    tenantsOnboarded: 1,
    revenueAttributed: { amount: 120000, currency: 'XAF' },
    eventCount: 2,
  },
  {
    periodKey: '2026-09',
    leadsGenerated: 5,
    dealsClosed: 2,
    propertiesReferred: 2,
    landlordsOnboarded: 1,
    tenantsOnboarded: 1,
    revenueAttributed: { amount: 300000, currency: 'XAF' },
    eventCount: 3,
  },
];

describe('AgentPerformanceTab', () => {
  it('renders the metric label, granularity and total', () => {
    render(<AgentPerformanceTab buckets={buckets} granularity="monthly" metric="leadsGenerated" />);
    expect(screen.getByText(/Leads · monthly/)).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument(); // 3 + 5
  });

  it('renders the data table with all metrics', () => {
    render(<AgentPerformanceTab buckets={buckets} granularity="monthly" metric="leadsGenerated" />);
    expect(screen.getByText('2026-08')).toBeInTheDocument();
    expect(screen.getByText('2026-09')).toBeInTheDocument();
    expect(screen.getByText('Properties referred')).toBeInTheDocument();
    expect(screen.getByText('Revenue attributed')).toBeInTheDocument();
  });

  it('renders an empty state when there are no buckets', () => {
    render(<AgentPerformanceTab buckets={[]} granularity="monthly" metric="leadsGenerated" />);
    expect(screen.getByText(/No performance data in the selected range/)).toBeInTheDocument();
  });

  it('formats money when the metric is revenueAttributed', () => {
    render(
      <AgentPerformanceTab buckets={buckets} granularity="monthly" metric="revenueAttributed" />,
    );
    expect(screen.getByText(/420,000 XAF/)).toBeInTheDocument();
  });
});
