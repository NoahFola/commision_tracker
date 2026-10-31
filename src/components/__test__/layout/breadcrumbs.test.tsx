// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { Breadcrumbs } from '../../layout/breadcrumbs';

afterEach(() => cleanup());

describe('Breadcrumbs', () => {
  it('renders "Dashboard" at the admin root', () => {
    mockPathname = '/admin';
    render(<Breadcrumbs />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders a single segment', () => {
    mockPathname = '/admin/agents';
    render(<Breadcrumbs />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('renders two segments with the last not linked', () => {
    mockPathname = '/admin/agents/abc123';
    render(<Breadcrumbs />);
    const agents = screen.getByRole('link', { name: 'Agents' });
    expect(agents).toHaveAttribute('href', '/admin/agents');
    // The last segment is not a link.
    expect(screen.queryByRole('link', { name: 'abc123' })).not.toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });
});
