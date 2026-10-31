// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Dialog } from '../ui-states/dialog';
// import { Dialog } from '../dialog';

afterEach(() => cleanup());

// happy-dom does not implement <dialog>.showModal / close in every
// version. We stub them so the component can be exercised.
beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined') {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  }
});

describe('Dialog', () => {
  it('renders the title and children', () => {
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Reverse commission"
        confirmLabel="Reverse"
        onConfirm={() => {}}
      >
        <p>Body text</p>
      </Dialog>,
    );
    expect(screen.getByText('Reverse commission')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('requires the confirmation token before enabling confirm', () => {
    const onConfirm = vi.fn();
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Reverse"
        confirmLabel="Reverse"
        confirmToken="CM-9D41F0"
        onConfirm={onConfirm}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: 'Reverse' });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type CM-9D41F0/), { target: { value: 'CM-9D41F0' } });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not call onConfirm when token does not match', () => {
    const onConfirm = vi.fn();
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Reverse"
        confirmLabel="Reverse"
        confirmToken="CM-9D41F0"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Type CM-9D41F0/), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="x" confirmLabel="ok" onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
