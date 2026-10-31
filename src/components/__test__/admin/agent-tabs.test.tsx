// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let mockPathname = '/admin/agents/a1';
let mockSearch = new URLSearchParams('tab=profile');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
}));

import { AgentTabs } from '../../admin/agent-tabs';

afterEach(() => cleanup());

describe('AgentTabs', () => {
  it('renders all four tabs', () => {
    mockSearch = new URLSearchParams('tab=profile');
    render(<AgentTabs current="profile" />);
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Performance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Commissions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Audit' })).toBeInTheDocument();
  });

  it('marks the active tab with aria-current', () => {
    mockSearch = new URLSearchParams('tab=performance');
    render(<AgentTabs current="performance" />);
    const performance = screen.getByRole('link', { name: 'Performance' });
    expect(performance).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });

  it('link hrefs set the tab param', () => {
    mockSearch = new URLSearchParams();
    render(<AgentTabs current="profile" />);
    expect(screen.getByRole('link', { name: 'Audit' }).getAttribute('href')).toContain('tab=audit');
  });

  it('strips page param when switching tabs', () => {
    mockSearch = new URLSearchParams('tab=profile&page=3');
    render(<AgentTabs current="profile" />);
    const href = screen.getByRole('link', { name: 'Performance' }).getAttribute('href');
    expect(href).not.toContain('page=');
    expect(href).toContain('tab=performance');
  });
});
