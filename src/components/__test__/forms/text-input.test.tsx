// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TextInput } from '../../forms/text-input';

afterEach(() => cleanup());

describe('TextInput', () => {
  it('renders a label wired to the input', () => {
    render(<TextInput name="ref" label="Referral code" />);
    const input = screen.getByLabelText('Referral code');
    expect(input).toBeInTheDocument();
  });

  it('renders helper text when there is no error', () => {
    render(<TextInput name="ref" label="Ref" helper="Must be unique." />);
    expect(screen.getByText('Must be unique.')).toBeInTheDocument();
  });

  it('renders an error instead of the helper when error is present', () => {
    render(<TextInput name="ref" label="Ref" helper="Must be unique." error="Already taken." />);
    expect(screen.getByText('Already taken.')).toBeInTheDocument();
    expect(screen.queryByText('Must be unique.')).not.toBeInTheDocument();
  });

  it('sets aria-invalid when error is present', () => {
    render(<TextInput name="ref" label="Ref" error="Bad" />);
    expect(screen.getByLabelText('Ref')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is controlled when value/onChange are supplied', () => {
    const fn = vi.fn();
    render(<TextInput name="ref" label="Ref" value="a" onChange={fn} />);
    fireEvent.change(screen.getByLabelText('Ref'), { target: { value: 'ab' } });
    expect(fn).toHaveBeenCalled();
  });

  it('respects the disabled prop', () => {
    render(<TextInput name="ref" label="Ref" disabled />);
    expect(screen.getByLabelText('Ref')).toBeDisabled();
  });
});
