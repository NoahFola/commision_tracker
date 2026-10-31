// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ErrorState } from '../ui-states/error-state';

afterEach(() => cleanup());

describe('ErrorState', () => {
  it('renders the title and description', () => {
    render(<ErrorState title="Failed to load" description="The server did not respond." />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByText('The server did not respond.')).toBeInTheDocument();
  });

  it('renders a retry button when onRetry is given', () => {
    const fn = vi.fn();
    render(<ErrorState title="x" onRetry={fn} />);
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(fn).toHaveBeenCalled();
  });

  it('omits the retry button when onRetry is absent', () => {
    render(<ErrorState title="x" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
