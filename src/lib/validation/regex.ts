/**
 * Regex constants shared between server-side validators and client-side
 * form helpers. Keeping them in one place guarantees the two never
 * drift.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[0-9 \-()]{6,30}$/;
export const PERIOD_RE = /^\d{4}-\d{2}$/;
export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const REFERRAL_CODE_RE = /^[A-Z0-9]{2,40}$/;
export const CORE_CUSTOMER_ID_RE = /^[A-Za-z0-9_\-]{1,100}$/;
