import { EMAIL_RE, PHONE_RE, PERIOD_RE, REFERRAL_CODE_RE } from '@/lib/validation/regex';

/**
 * Pure validators used by form components. They mirror the server-side
 * rules exactly — the regexes come from src/lib/validation/regex.ts.
 *
 * Each returns null when the value is acceptable, or a short
 * human-readable message when it is not. The message is what the UI
 * shows under the field.
 *
 * The server remains the source of truth. These are a UI convenience.
 */

export function validateEmail(value: string): string | null {
  if (!value) return 'Email is required.';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePhone(value: string): string | null {
  if (!value) return 'Phone number is required.';
  if (!PHONE_RE.test(value.trim())) {
    return 'Enter a valid phone number, e.g. +237 677 000 000.';
  }
  return null;
}

export function validateRequired(value: string, label = 'This field'): string | null {
  if (!value || value.trim().length === 0) return `${label} is required.`;
  return null;
}

export function validateReferralCode(value: string): string | null {
  if (!value) return 'Referral code is required.';
  if (!REFERRAL_CODE_RE.test(value.trim().toUpperCase())) {
    return 'Referral code must be 2–40 letters or digits.';
  }
  return null;
}

export function validatePeriod(value: string): string | null {
  if (!value) return 'Period is required.';
  if (!PERIOD_RE.test(value)) return 'Period must look like 2026-09.';
  return null;
}

/**
 * Base amount for a commission. Positive integer, no decimals.
 * Matches the server's Money validator.
 */
export function validateBaseAmount(value: string): string | null {
  if (!value || value.trim().length === 0) return 'Amount is required.';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Amount must be a number.';
  if (!Number.isInteger(n)) return 'Amount must be a whole number.';
  if (n <= 0) return 'Amount must be greater than zero.';
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < 10) return 'Password must be at least 10 characters.';
  if (value.length > 72) return 'Password must be at most 72 characters.';
  return null;
}

/**
 * First error found on a map of values and validators. Useful for
 * "validate all and stop at the first failure" cases where you don't
 * need per-field errors.
 */
export function firstError(
  values: Record<string, string>,
  validators: Record<string, (v: string) => string | null>,
): string | null {
  for (const [field, validator] of Object.entries(validators)) {
    const err = validator(values[field] ?? '');
    if (err) return err;
  }
  return null;
}
