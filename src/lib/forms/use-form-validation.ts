'use client';

import { useCallback, useMemo, useState } from 'react';

export type FieldErrors = Record<string, string | undefined>;

/**
 * Small form-validation hook. Tracks:
 *   - which fields have been touched (blur or change)
 *   - whether the form has been submitted at least once
 *   - the current errors per field
 *
 * An error is *displayed* for a field when the field has been touched
 * OR the form has been submitted. Before that, the field is neutral.
 *
 * The hook does not know the rules. The caller supplies a validator
 * map; the hook calls it when needed and stores the result.
 *
 *   const { values, errors, visibleErrors, setField, touchField,
 *           validateAll, setError, clearError } = useFormValidation({
 *     initial: { email: '', phone: '' },
 *     validators: {
 *       email: validateEmail,
 *       phone: validatePhone,
 *     },
 *   });
 */

export type Validator<T extends string> = (value: string) => string | null;

export type UseFormValidationOptions<T extends string> = {
  initial: Record<T, string>;
  validators: Partial<Record<T, Validator<T>>>;
};

export function useFormValidation<T extends string>(
  options: UseFormValidationOptions<T>,
): {
  values: Record<T, string>;
  errors: FieldErrors;
  visibleErrors: FieldErrors;
  setField: (field: T, value: string) => void;
  touchField: (field: T) => void;
  validateAll: () => boolean;
  setError: (field: T, message: string) => void;
  clearError: (field: T) => void;
} {
  const [values, setValues] = useState<Record<T, string>>(options.initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const setField = useCallback((field: T, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear the error for this field as the user types; the next
    // validateAll (or blur) will re-set it if it's still wrong.
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const touchField = useCallback(
    (field: T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const validator = options.validators[field];
      if (validator) {
        const err = validator(values[field] ?? '');
        setErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
      }
    },
    [options.validators, values],
  );

  const validateAll = useCallback(() => {
    setSubmitted(true);
    const nextErrors: FieldErrors = {};
    let ok = true;
    for (const [field, validator] of Object.entries(options.validators) as [T, Validator<T>][]) {
      const err = validator(values[field] ?? '');
      if (err) {
        nextErrors[field] = err;
        ok = false;
      }
    }
    setErrors(nextErrors);
    return ok;
  }, [options.validators, values]);

  const setError = useCallback((field: T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const clearError = useCallback((field: T) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const visibleErrors: FieldErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [field, err] of Object.entries(errors)) {
      if (!err) continue;
      if (submitted || touched[field as T]) {
        out[field] = err;
      }
    }
    return out;
  }, [errors, submitted, touched]);

  return {
    values,
    errors,
    visibleErrors,
    setField,
    touchField,
    validateAll,
    setError,
    clearError,
  };
}
