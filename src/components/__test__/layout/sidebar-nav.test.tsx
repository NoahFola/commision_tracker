// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let mockPathname = '/admin/agents';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { SidebarNav } from '../../layout/sidebar-nav';

afterEach(() => cleanup());

describe('SidebarNav', () => {
  it('renders all six nav items', () => {
    mockPathname = '/admin';
    render(<SidebarNav />);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agents/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Regions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Commissions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Payout batches/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument();
  });

  it('marks the active item with aria-current', () => {
    mockPathname = '/admin/agents';
    render(<SidebarNav />);
    const agents = screen.getByRole('link', { name: /Agents/ });
    expect(agents).toHaveAttribute('aria-current', 'page');

    const dashboard = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboard).not.toHaveAttribute('aria-current');
  });

  it('keeps the active state on a detail page', () => {
    mockPathname = '/admin/agents/abc123';
    render(<SidebarNav />);
    const agents = screen.getByRole('link', { name: /Agents/ });
    expect(agents).toHaveAttribute('aria-current', 'page');
  });
});
