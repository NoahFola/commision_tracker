import { describe, it, expect } from 'vitest';
import {
  assertValidBatchTransition,
  isTerminalBatchStatus,
  isBatchEditable,
  sumCommissionNetAmounts,
  assertMeetsMinimumBatchAmount,
  MINIMUM_BATCH_AMOUNT_XAF,
} from '../payout-batch.service';

describe('payout batch state machine', () => {
  const allowed: Array<[string, string]> = [
    ['DRAFT', 'APPROVED'],
    ['DRAFT', 'FAILED'],
    ['APPROVED', 'PROCESSING'],
    ['APPROVED', 'PAID'],
    ['APPROVED', 'FAILED'],
    ['PROCESSING', 'PAID'],
    ['PROCESSING', 'FAILED'],
  ];
  for (const [from, to] of allowed) {
    it(`allows ${from} -> ${to}`, () => {
      expect(() => assertValidBatchTransition(from as never, to as never)).not.toThrow();
    });
  }

  const rejected: Array<[string, string]> = [
    ['DRAFT', 'PROCESSING'],
    ['DRAFT', 'PAID'],
    ['APPROVED', 'DRAFT'],
    ['PAID', 'FAILED'],
    ['PAID', 'PAID'],
    ['FAILED', 'DRAFT'],
    ['FAILED', 'PAID'],
  ];
  for (const [from, to] of rejected) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(() => assertValidBatchTransition(from as never, to as never)).toThrow();
    });
  }

  it('terminal statuses are PAID and FAILED only', () => {
    expect(isTerminalBatchStatus('PAID')).toBe(true);
    expect(isTerminalBatchStatus('FAILED')).toBe(true);
    expect(isTerminalBatchStatus('DRAFT')).toBe(false);
    expect(isTerminalBatchStatus('APPROVED')).toBe(false);
    expect(isTerminalBatchStatus('PROCESSING')).toBe(false);
  });

  it('only DRAFT is editable', () => {
    expect(isBatchEditable('DRAFT')).toBe(true);
    expect(isBatchEditable('APPROVED')).toBe(false);
    expect(isBatchEditable('PROCESSING')).toBe(false);
    expect(isBatchEditable('PAID')).toBe(false);
    expect(isBatchEditable('FAILED')).toBe(false);
  });
});

describe('sumCommissionNetAmounts', () => {
  it('sums same-currency amounts', () => {
    const r = sumCommissionNetAmounts([
      { netAmount: { amount: 1000, currency: 'XAF' } },
      { netAmount: { amount: 500, currency: 'XAF' } },
    ]);
    expect(r).toEqual({ amount: 1500, currency: 'XAF' });
  });

  it('returns 0 XAF for an empty list', () => {
    expect(sumCommissionNetAmounts([])).toEqual({ amount: 0, currency: 'XAF' });
  });

  it('rejects mixed currencies', () => {
    expect(() =>
      sumCommissionNetAmounts([
        { netAmount: { amount: 1000, currency: 'XAF' } },
        { netAmount: { amount: 500, currency: 'USD' } },
      ]),
    ).toThrow();
  });
});

describe('assertMeetsMinimumBatchAmount', () => {
  it('accepts totals at or above the minimum', () => {
    expect(() =>
      assertMeetsMinimumBatchAmount({ amount: MINIMUM_BATCH_AMOUNT_XAF, currency: 'XAF' }),
    ).not.toThrow();
    expect(() => assertMeetsMinimumBatchAmount({ amount: 10000, currency: 'XAF' })).not.toThrow();
  });

  it('rejects totals below the minimum', () => {
    expect(() =>
      assertMeetsMinimumBatchAmount({ amount: MINIMUM_BATCH_AMOUNT_XAF - 1, currency: 'XAF' }),
    ).toThrow();
  });

  it('rejects non-XAF currencies', () => {
    expect(() => assertMeetsMinimumBatchAmount({ amount: 10000, currency: 'USD' })).toThrow();
  });
});
