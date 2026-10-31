// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ui-states/toast-provider';

afterEach(() => cleanup());

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Saved')}>success</button>
      <button onClick={() => toast.error('Failed', 'Server down')}>error</button>
    </div>
  );
}

describe('ToastProvider', () => {
  it('renders a success toast', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('success'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('renders an error toast with a description', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('error'));
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Server down')).toBeInTheDocument();
  });

  it('dismisses a toast when its close button is clicked', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('success'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('auto-dismisses success toasts after 5s', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('success'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
