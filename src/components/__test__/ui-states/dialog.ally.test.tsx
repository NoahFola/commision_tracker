// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Dialog } from '@/components/ui-states/dialog';

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

afterEach(() => cleanup());

describe('Dialog accessibility', () => {
  it('renders the title as a heading', () => {
    render(
      <Dialog open onClose={() => {}} title="Test dialog" confirmLabel="OK" onConfirm={() => {}}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Test dialog' })).toBeInTheDocument();
  });

  it('has both a cancel and a confirm button with accessible names', () => {
    render(<Dialog open onClose={() => {}} title="x" confirmLabel="Do it" onConfirm={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument();
  });
});
