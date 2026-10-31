// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CurrencyAmount } from '../../primitives/currency-amount';

afterEach(() => cleanup());

describe('CurrencyAmount', () => {
  it('renders amount and currency separately', () => {
    const { container } = render(<CurrencyAmount value={{ amount: 15675, currency: 'XAF' }} />);
    expect(container.textContent).toBe('15,675 XAF');
  });

  it('uses tabular figures', () => {
    const { container } = render(<CurrencyAmount value={{ amount: 100, currency: 'XAF' }} />);
    expect(container.firstChild).toHaveClass('amount');
  });

  it('does not colour a negative by default', () => {
    const { container } = render(<CurrencyAmount value={{ amount: -9500, currency: 'XAF' }} />);
    expect(container.firstChild).not.toHaveClass('text-danger-fg');
  });

  it('marks a negative in red when signed', () => {
    const { container } = render(
      <CurrencyAmount value={{ amount: -9500, currency: 'XAF' }} signed />,
    );
    expect(container.firstChild).toHaveClass('text-danger-fg');
  });
});
