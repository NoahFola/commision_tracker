import { type Currency, isValidMinorAmount } from './currency';

/**
 * Money is an integer amount in the smallest unit of a currency.
 * Never construct this from a float. Never mix currencies in one operation.
 */
export type Money = {
  amount: number; // integer, smallest unit
  currency: Currency;
};

export function makeMoney(amount: number, currency: Currency): Money {
  if (!isValidMinorAmount(amount, currency)) {
    throw new Error(`Invalid money: amount=${amount} currency=${currency}`);
  }
  return { amount, currency };
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function moneyEquals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

/** Add two Money values of the same currency. Throws on mismatch. */
export function moneyAdd(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

/** Subtract b from a, same currency only. */
export function moneySub(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export const ZERO_XAF: Money = { amount: 0, currency: 'XAF' };
