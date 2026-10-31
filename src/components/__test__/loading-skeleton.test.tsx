// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LoadingSkeleton } from '../ui-states/loading-skeleton';

afterEach(() => cleanup());

describe('LoadingSkeleton', () => {
  it('renders the requested number of rows', () => {
    const { container } = render(<LoadingSkeleton rows={3} columns={4} />);
    // 3 rows × 4 columns = 12 bars
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(12);
  });

  it('has an accessible loading label', () => {
    render(<LoadingSkeleton />);
    expect(document.querySelector('[role="status"]')).toBeInTheDocument();
  });
});
