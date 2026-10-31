// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { AgentBottomNav } from '@/components/layout/agent-bottom-nav';

afterEach(() => cleanup());

describe('AgentBottomNav accessibility', () => {
  it('has a navigation landmark', () => {
    render(<AgentBottomNav />);
    expect(screen.getByRole('navigation', { name: 'Agent navigation' })).toBeInTheDocument();
  });

  it('every link has accessible text', () => {
    render(<AgentBottomNav />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link).toHaveAccessibleName();
    }
  });
});
