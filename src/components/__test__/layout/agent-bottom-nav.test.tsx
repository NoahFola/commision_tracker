// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { AgentBottomNav } from '@/components/layout/agent-bottom-nav';

afterEach(() => cleanup());

describe('AgentBottomNav', () => {
  it('renders all four tabs', () => {
    mockPathname = '/';
    render(<AgentBottomNav />);
    expect(screen.getByRole('link', { name: /Home/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Commissions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Payouts/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Performance/ })).toBeInTheDocument();
  });

  it('marks Home active on the exact root path', () => {
    mockPathname = '/';
    render(<AgentBottomNav />);
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Commissions/ })).not.toHaveAttribute('aria-current');
  });

  it('marks Commissions active on a detail path', () => {
    mockPathname = '/commissions/abc123';
    render(<AgentBottomNav />);
    expect(screen.getByRole('link', { name: /Commissions/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
