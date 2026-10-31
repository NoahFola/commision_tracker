// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFormValidation } from '../use-form-validation';
import { validateEmail, validatePhone } from '../validators';

afterEach(() => cleanup());

function setup() {
  return renderHook(() =>
    useFormValidation({
      initial: { email: '', phone: '' },
      validators: { email: validateEmail, phone: validatePhone },
    }),
  );
}

describe('useFormValidation', () => {
  it('starts neutral: errors exist internally but none are visible', () => {
    const { result } = setup();
    expect(result.current.values.email).toBe('');
    expect(result.current.visibleErrors.email).toBeUndefined();
  });

  it('setField updates the value and clears that field error', () => {
    const { result } = setup();
    act(() => result.current.setField('email', 'a'));
    expect(result.current.values.email).toBe('a');

    // Even after touch, the error for a valid-looking email clears.
    act(() => result.current.setField('email', 'a@b.cm'));
    act(() => result.current.touchField('email'));
    expect(result.current.visibleErrors.email).toBeUndefined();
  });

  it('touchField surfaces the error for that field only', () => {
    const { result } = setup();
    act(() => result.current.touchField('email'));
    expect(result.current.visibleErrors.email).toMatch(/required/);
    expect(result.current.visibleErrors.phone).toBeUndefined();
  });

  it('validateAll surfaces every error', () => {
    const { result } = setup();
    let ok = true;
    act(() => {
      ok = result.current.validateAll();
    });
    expect(ok).toBe(false);
    expect(result.current.visibleErrors.email).toBeDefined();
    expect(result.current.visibleErrors.phone).toBeDefined();
  });

  it('validateAll returns true when everything passes', () => {
    const { result } = setup();
    act(() => result.current.setField('email', 'a@b.cm'));
    act(() => result.current.setField('phone', '+237677000000'));
    let ok = false;
    act(() => {
      ok = result.current.validateAll();
    });
    expect(ok).toBe(true);
    expect(result.current.visibleErrors).toEqual({});
  });

  it('setError and clearError are available for manual control', () => {
    const { result } = setup();
    act(() => result.current.setError('email', 'This email is already used.'));
    expect(result.current.visibleErrors.email).toBe('This email is already used.');
    act(() => result.current.clearError('email'));
    expect(result.current.visibleErrors.email).toBeUndefined();
  });
});
