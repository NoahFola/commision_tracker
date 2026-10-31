// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EmptyState } from '../ui-states/empty-state';

afterEach(() => cleanup());

describe('EmptyState', () => {
  it('renders the no-matches variant', () => {
    render(
      <EmptyState
        variant="no-matches"
        entityLabel="commissions"
        actionLabel="Clear filters"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText(/No commissions match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
  });

  it('renders the first-use variant', () => {
    render(
      <EmptyState
        variant="first-use"
        entityLabel="commissions"
        actionLabel="New commission"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText(/No commissions yet/i)).toBeInTheDocument();
  });

  it('calls the action when clicked', () => {
    const fn = vi.fn();
    render(
      <EmptyState variant="first-use" entityLabel="commissions" actionLabel="New" onAction={fn} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalled();
  });
});
