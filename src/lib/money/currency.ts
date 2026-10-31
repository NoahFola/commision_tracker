/**
 * Supported currencies for the Tracker.
 * XAF is zero-decimal (whole units). USD and EUR use cents (2 decimals).
 *
 * Adding a currency later is a two-line change: extend the union and
 * add its exponent to MINOR_UNIT_EXPONENT.
 */
export type Currency = 'XAF' | 'USD' | 'EUR';

/**
 * Number of decimal places in the smallest unit of each currency.
 * XAF: 0  → amount 5000 means 5,000 XAF.
 * USD: 2  → amount 5000 means 50.00 USD.
 */
export const MINOR_UNIT_EXPONENT: Record<Currency, number> = {
  XAF: 0,
  USD: 2,
  EUR: 2,
};

const CURRENCIES: readonly Currency[] = ['XAF', 'USD', 'EUR'];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Returns true if `amount` is a valid integer amount in the smallest
 * unit of `currency`. Rejects floats, NaN, Infinity, non-numbers.
 * This is the single guard that prevents float money from entering the system.
 */
export function isValidMinorAmount(amount: unknown, currency: Currency): boolean {
  if (typeof amount !== 'number') return false;
  if (!Number.isFinite(amount)) return false;
  if (!Number.isInteger(amount)) return false;
  // Amounts may be negative (clawbacks / reversals); no range cap beyond safe integer.
  if (!Number.isSafeInteger(amount)) return false;
  // Guard against a currency typo silently passing.
  if (!isCurrency(currency)) return false;
  return true;
}
