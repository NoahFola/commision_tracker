// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DateTime } from '../../primitives/date-time';

afterEach(() => cleanup());

describe('DateTime', () => {
  const iso = '2026-09-30T14:23:00.000Z'; // 15:23 WAT

  it('renders a WAT date', () => {
    const { container } = render(<DateTime value={iso} variant="date" />);
    expect(container.textContent).toBe('30 Sep 2026');
  });

  it('renders a WAT time', () => {
    const { container } = render(<DateTime value={iso} variant="time" />);
    expect(container.textContent).toBe('15:23 WAT');
  });

  it('renders a combined WAT datetime', () => {
    const { container } = render(<DateTime value={iso} variant="datetime" />);
    expect(container.textContent).toBe('30 Sep 2026, 15:23 WAT');
  });
});
