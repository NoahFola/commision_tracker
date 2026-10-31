// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SelectionBanner } from '../ui-states/selection-banner';

afterEach(() => cleanup());

describe('SelectionBanner', () => {
  it('renders nothing when count is zero', () => {
    const { container } = render(
      <SelectionBanner count={0} onExport={() => {}} onClear={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the count and both actions when count is positive', () => {
    render(<SelectionBanner count={3} onExport={() => {}} onClear={() => {}} />);
    expect(screen.getByText('3 selected on this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export selected/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear selection/ })).toBeInTheDocument();
  });

  it('calls onExport when the export button is clicked', () => {
    const fn = vi.fn();
    render(<SelectionBanner count={1} onExport={fn} onClear={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Export selected/ }));
    expect(fn).toHaveBeenCalled();
  });

  it('calls onClear when the clear button is clicked', () => {
    const fn = vi.fn();
    render(<SelectionBanner count={1} onExport={() => {}} onClear={fn} />);
    fireEvent.click(screen.getByRole('button', { name: /Clear selection/ }));
    expect(fn).toHaveBeenCalled();
  });

  it('shows a loading label when exporting is true and disables the button', () => {
    render(<SelectionBanner count={1} onExport={() => {}} onClear={() => {}} exporting />);
    const exportBtn = screen.getByRole('button', { name: /Exporting/ });
    expect(exportBtn).toBeDisabled();
  });
});
