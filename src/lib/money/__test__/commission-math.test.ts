import { describe, it, expect } from 'vitest';
import { computeCommissionAmounts, negateAmounts } from '../commission-math';
import { BadRequestError } from '@/lib/errors/app-error';

describe('computeCommissionAmounts', () => {
  it('computes gross, fee, net with integer math', () => {
    // 5% of 20,000 XAF = 1,000 XAF gross; 5% platform fee = 50 XAF; net = 950 XAF.
    const r = computeCommissionAmounts({ amount: 20000, currency: 'XAF' }, 500, 500);
    expect(r.grossAmount).toEqual({ amount: 1000, currency: 'XAF' });
    expect(r.platformFee).toEqual({ amount: 50, currency: 'XAF' });
    expect(r.netAmount).toEqual({ amount: 950, currency: 'XAF' });
  });

  it('floors fractional units (favours the platform slightly)', () => {
    // 5% of 1,999 XAF = 99.95 -> floor 99
    const r = computeCommissionAmounts({ amount: 1999, currency: 'XAF' }, 500, 500);
    expect(r.grossAmount.amount).toBe(99);
    expect(r.platformFee.amount).toBe(4); // 5% of 99 = 4.95 -> 4
    expect(r.netAmount.amount).toBe(95);
  });

  it('preserves currency', () => {
    const r = computeCommissionAmounts({ amount: 100, currency: 'USD' }, 500, 0);
    expect(r.grossAmount.currency).toBe('USD');
    expect(r.platformFee.currency).toBe('USD');
    expect(r.netAmount.currency).toBe('USD');
  });

  it('handles zero platform fee', () => {
    const r = computeCommissionAmounts({ amount: 10000, currency: 'XAF' }, 500, 0);
    expect(r.platformFee.amount).toBe(0);
    expect(r.netAmount.amount).toBe(r.grossAmount.amount);
  });

  it('rejects out-of-range rates and non-integer base', () => {
    expect(() => computeCommissionAmounts({ amount: 100, currency: 'XAF' }, -1, 500)).toThrow(
      BadRequestError,
    );
    expect(() => computeCommissionAmounts({ amount: 100, currency: 'XAF' }, 10001, 500)).toThrow(
      BadRequestError,
    );
    expect(() => computeCommissionAmounts({ amount: 10.5, currency: 'XAF' }, 500, 500)).toThrow(
      BadRequestError,
    );
  });
});

describe('negateAmounts', () => {
  it('flips sign on every field', () => {
    const n = negateAmounts({
      grossAmount: { amount: 1000, currency: 'XAF' },
      platformFee: { amount: 50, currency: 'XAF' },
      netAmount: { amount: 950, currency: 'XAF' },
    });
    expect(n.grossAmount).toEqual({ amount: -1000, currency: 'XAF' });
    expect(n.platformFee).toEqual({ amount: -50, currency: 'XAF' });
    expect(n.netAmount).toEqual({ amount: -950, currency: 'XAF' });
  });

  it('sum of original and negated is zero', () => {
    const a = {
      grossAmount: { amount: 1000, currency: 'XAF' as const },
      platformFee: { amount: 50, currency: 'XAF' as const },
      netAmount: { amount: 950, currency: 'XAF' as const },
    };
    const b = negateAmounts(a);
    expect(a.grossAmount.amount + b.grossAmount.amount).toBe(0);
    expect(a.platformFee.amount + b.platformFee.amount).toBe(0);
    expect(a.netAmount.amount + b.netAmount.amount).toBe(0);
  });
});
