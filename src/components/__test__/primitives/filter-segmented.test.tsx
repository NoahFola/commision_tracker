// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FilterSegmented } from '../../primitives/filter-segmented';

afterEach(() => cleanup());

const OPTIONS = [
  { value: '' as const, label: 'All' },
  { value: 'AGENT' as const, label: 'Agents' },
  { value: 'AMBASSADOR' as const, label: 'Ambassadors' },
];

describe('FilterSegmented', () => {
  it('renders every option', () => {
    render(<FilterSegmented name="type" value="" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ambassadors' })).toBeInTheDocument();
  });

  it('marks the active option with aria-pressed', () => {
    render(<FilterSegmented name="type" value="AGENT" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('button', { name: 'Agents' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked value', () => {
    const fn = vi.fn();
    render(<FilterSegmented name="type" value="" onChange={fn} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ambassadors' }));
    expect(fn).toHaveBeenCalledWith('AMBASSADOR');
  });

  it('calls onChange with an empty string when "All" is clicked', () => {
    const fn = vi.fn();
    render(<FilterSegmented name="type" value="AGENT" onChange={fn} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(fn).toHaveBeenCalledWith('');
  });
});
