// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FilterBar } from '../primitives/filter-bar';
import { FilterSelect } from '../primitives/filter-select';
import { FilterSearch } from '../primitives/filter-search';
import { FilterPeriod } from '../primitives/filter-period';

afterEach(() => cleanup());

describe('FilterBar', () => {
  it('renders children and the trailing element', () => {
    render(
      <FilterBar trailing="Showing 1–10 of 138">
        <span>a filter</span>
      </FilterBar>,
    );
    expect(screen.getByText('a filter')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 138')).toBeInTheDocument();
  });
});

describe('FilterSelect', () => {
  it('calls onChange with the new value', () => {
    const fn = vi.fn();
    render(
      <FilterSelect
        name="status"
        label="Status"
        value=""
        onChange={fn}
        options={[
          { value: 'PENDING' as const, label: 'Pending' },
          { value: 'PAID' as const, label: 'Paid' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PAID' } });
    expect(fn).toHaveBeenCalledWith('PAID');
  });
});

describe('FilterSearch', () => {
  it('calls onChange as the user types', () => {
    const fn = vi.fn();
    render(<FilterSearch name="search" placeholder="Search customer ID" value="" onChange={fn} />);
    fireEvent.change(screen.getByPlaceholderText('Search customer ID'), {
      target: { value: 'CUST-04' },
    });
    expect(fn).toHaveBeenCalledWith('CUST-04');
  });
});

describe('FilterPeriod', () => {
  it('renders a month input with the current value', () => {
    render(<FilterPeriod name="period" label="Period" value="2026-09" onChange={() => {}} />);
    const input = screen.getByLabelText('Period') as HTMLInputElement;
    expect(input.type).toBe('month');
    expect(input.value).toBe('2026-09');
  });
});
