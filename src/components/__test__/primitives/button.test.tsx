// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Button, ButtonLink } from '../../primitives/button';

afterEach(() => cleanup());

describe('Button', () => {
  it('renders a button by default with type="button"', () => {
    render(<Button>Click</Button>);
    const b = screen.getByRole('button');
    expect(b).toHaveAttribute('type', 'button');
    expect(b).toHaveTextContent('Click');
  });

  it('honours the type prop', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('calls onClick when clicked', () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const fn = vi.fn();
    render(
      <Button disabled onClick={fn}>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', () => {
    const fn = vi.fn();
    render(
      <Button loading loadingLabel="Saving…" onClick={fn}>
        Save
      </Button>,
    );
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveTextContent('Saving…');
    fireEvent.click(b);
    expect(fn).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'danger', 'ghost'] as const)(
    'renders the %s variant without crashing',
    (variant) => {
      render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    },
  );

  it('applies size classes', () => {
    render(<Button size="small">x</Button>);
    expect(screen.getByRole('button').className).toContain('text-xs');
  });
});

describe('ButtonLink', () => {
  it('renders a Next.js Link for internal hrefs', () => {
    render(<ButtonLink href="/agents">Agents</ButtonLink>);
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('href', '/agents');
  });

  it('renders an anchor for external hrefs', () => {
    render(<ButtonLink href="https://example.com">External</ButtonLink>);
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('href', 'https://example.com');
  });
});
