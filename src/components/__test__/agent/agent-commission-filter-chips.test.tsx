// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/commissions',
  useSearchParams: () => new URLSearchParams(''),
}));

import { AgentCommissionFilterChips } from '@/components/agent/agent-commission-filter-chips';

afterEach(() => cleanup());

describe('AgentCommissionFilterChips', () => {
  it('renders all four chips', () => {
    render(<AgentCommissionFilterChips current="all" />);
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Being checked' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ready to pay' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Paid' })).toBeInTheDocument();
  });

  it('marks the current chip as selected', () => {
    render(<AgentCommissionFilterChips current="ready-to-pay" />);
    expect(screen.getByRole('tab', { name: 'Ready to pay' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
  });
});
