// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CopyButton } from '../../primitives/copy-button';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CopyButton', () => {
  it('renders the text variant by default', () => {
    render(<CopyButton value="CM-9F2A41" />);
    expect(screen.getByRole('button')).toHaveTextContent('Copy');
  });

  it('renders the icon variant with an accessible label', () => {
    render(<CopyButton value="CM-9F2A41" variant="icon" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy CM-9F2A41');
  });
});
