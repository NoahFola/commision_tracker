// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TableShell } from '../ui-states/table-shell';

afterEach(() => cleanup());

describe('TableShell', () => {
  it('renders children when loaded', () => {
    render(
      <TableShell state="loaded">
        <span>a table row</span>
      </TableShell>,
    );
    expect(screen.getByText('a table row')).toBeInTheDocument();
  });

  it('renders skeletons when loading', () => {
    const { container } = render(<TableShell state="loading" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the error state', () => {
    render(<TableShell state="error" errorTitle="Failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    render(
      <TableShell
        state="empty"
        emptyVariant="first-use"
        emptyEntityLabel="commissions"
        emptyActionLabel="New commission"
      />,
    );
    expect(screen.getByText(/No commissions yet/i)).toBeInTheDocument();
  });
});
