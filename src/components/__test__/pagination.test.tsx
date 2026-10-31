// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/agents',
  useSearchParams: () => new URLSearchParams('status=ACTIVE&page=2'),
}));

import { Pagination } from '../ui-states/pagination';

afterEach(() => cleanup());

describe('Pagination', () => {
  it('shows the "X–Y of Z" indicator', () => {
    render(<Pagination page={2} limit={10} total={24} />);
    expect(screen.getByText('11–20 of 24')).toBeInTheDocument();
  });

  it('shows 0–0 when the total is zero', () => {
    render(<Pagination page={1} limit={10} total={0} />);
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
  });

  it('renders the rows-per-page select with the current limit', () => {
    render(<Pagination page={1} limit={25} total={100} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('25');
  });

  it('disables Previous on the first page', () => {
    render(<Pagination page={1} limit={10} total={100} />);
    const prev = screen.getByRole('link', { name: 'Previous' });
    expect(prev).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables Next on the last page', () => {
    render(<Pagination page={10} limit={10} total={100} />);
    const next = screen.getByRole('link', { name: 'Next' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
  });

  it('preserves existing query params in the Previous link', () => {
    render(<Pagination page={2} limit={10} total={100} />);
    const prev = screen.getByRole('link', { name: 'Previous' });
    expect(prev.getAttribute('href')).toContain('status=ACTIVE');
    expect(prev.getAttribute('href')).toContain('page=1');
  });
});
