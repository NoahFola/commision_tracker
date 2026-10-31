import { describe, it, expect } from 'vitest';
import { isValidMinorAmount, isCurrency } from '../currency';
import { makeMoney, moneyAdd, moneySub, moneyEquals, assertSameCurrency } from '../money';

describe('currency', () => {
  it('recognizes known currencies and rejects unknown', () => {
    expect(isCurrency('XAF')).toBe(true);
    expect(isCurrency('USD')).toBe(true);
    expect(isCurrency('EUR')).toBe(true);
    expect(isCurrency('GBP')).toBe(false);
    expect(isCurrency('xaf')).toBe(false);
    expect(isCurrency(123)).toBe(false);
  });

  it('rejects floats, NaN, Infinity, and non-numbers', () => {
    expect(isValidMinorAmount(5000, 'XAF')).toBe(true);
    expect(isValidMinorAmount(0, 'XAF')).toBe(true);
    expect(isValidMinorAmount(-5000, 'XAF')).toBe(true); // reversals/clawbacks
    expect(isValidMinorAmount(50.5, 'XAF')).toBe(false);
    expect(isValidMinorAmount(NaN, 'XAF')).toBe(false);
    expect(isValidMinorAmount(Infinity, 'XAF')).toBe(false);
    expect(isValidMinorAmount('5000', 'XAF')).toBe(false);
  });
});

describe('money', () => {
  it('makeMoney validates the amount', () => {
    expect(makeMoney(5000, 'XAF')).toEqual({ amount: 5000, currency: 'XAF' });
    expect(() => makeMoney(50.5, 'USD')).toThrow();
  });

  it('moneyAdd / moneySub keep currency and integer arithmetic', () => {
    const a = makeMoney(5000, 'XAF');
    const b = makeMoney(2500, 'XAF');
    expect(moneyAdd(a, b)).toEqual({ amount: 7500, currency: 'XAF' });
    expect(moneySub(a, b)).toEqual({ amount: 2500, currency: 'XAF' });
  });

  it('throws on currency mismatch', () => {
    const a = makeMoney(5000, 'XAF');
    const b = makeMoney(5000, 'USD');
    expect(() => assertSameCurrency(a, b)).toThrow();
    expect(() => moneyAdd(a, b)).toThrow();
  });

  it('moneyEquals compares amount and currency', () => {
    expect(moneyEquals(makeMoney(5000, 'XAF'), makeMoney(5000, 'XAF'))).toBe(true);
    expect(moneyEquals(makeMoney(5000, 'XAF'), makeMoney(5000, 'USD'))).toBe(false);
    expect(moneyEquals(makeMoney(5000, 'XAF'), makeMoney(5001, 'XAF'))).toBe(false);
  });
});
