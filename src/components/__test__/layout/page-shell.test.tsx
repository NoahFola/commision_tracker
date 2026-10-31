// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/agents',
}));

import { PageShell } from '../../layout/page-shell';

afterEach(() => cleanup());

describe('PageShell', () => {
  it('renders the title, subtitle, and children', () => {
    render(
      <PageShell title="Agents" subtitle="24 agents">
        <p>body content</p>
      </PageShell>,
    );
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByText('24 agents')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  it('renders the action slot in the top bar', () => {
    render(
      <PageShell title="Agents" action={<button>New agent</button>}>
        <p>body</p>
      </PageShell>,
    );
    expect(screen.getByRole('button', { name: 'New agent' })).toBeInTheDocument();
  });
});
