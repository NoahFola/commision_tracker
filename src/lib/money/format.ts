import type { Money } from './money';

/**
 * Formats a Money value for display. No decimals for XAF; two for USD/EUR.
 * Uses comma grouping. Never abbreviates ("12.5K" is banned by the design
 * brief).
 *
 *   formatMoney({ amount: 1234567, currency: 'XAF' }) === '1,234,567 XAF'
 *   formatMoney({ amount: 12345, currency: 'USD' })   === '123.45 USD'
 */
export function formatMoney(money: Money): string {
  const decimals = money.currency === 'XAF' ? 0 : 2;
  const divisor = money.currency === 'XAF' ? 1 : 100;
  const value = money.amount / divisor;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${formatted} ${money.currency}`;
}

/**
 * Compact form used inside table cells where the currency is already
 * shown in a column header. Returns just the number, grouped.
 */
export function formatAmountOnly(money: Money): string {
  const decimals = money.currency === 'XAF' ? 0 : 2;
  const divisor = money.currency === 'XAF' ? 1 : 100;
  const value = money.amount / divisor;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}