import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  parseCreateCommissionBody,
  parseReverseCommissionBody,
  parseListCommissionsQuery,
} from '../commission';

const agentId = new Types.ObjectId().toHexString();

describe('parseCreateCommissionBody', () => {
  it('accepts a valid body and normalizes the date', () => {
    const b = parseCreateCommissionBody({
      agentId,
      coreCustomerId: 'CUST-001',
      firstPaymentConfirmedAt: '2026-09-15T10:00:00Z',
      baseAmount: { amount: 20000, currency: 'XAF' },
    });
    expect(b.agentId).toBe(agentId);
    expect(b.coreCustomerId).toBe('CUST-001');
    expect(b.baseAmount).toEqual({ amount: 20000, currency: 'XAF' });
    expect(b.firstPaymentConfirmedAt).toBe('2026-09-15T10:00:00.000Z');
  });

  it('rejects missing/invalid fields', () => {
    expect(() =>
      parseCreateCommissionBody({
        coreCustomerId: 'X',
        firstPaymentConfirmedAt: '2026-01-01',
        baseAmount: { amount: 1, currency: 'XAF' },
      }),
    ).toThrow(/agentId/);
    expect(() =>
      parseCreateCommissionBody({
        agentId,
        firstPaymentConfirmedAt: '2026-01-01',
        baseAmount: { amount: 1, currency: 'XAF' },
      }),
    ).toThrow(/coreCustomerId/);
    expect(() =>
      parseCreateCommissionBody({
        agentId,
        coreCustomerId: 'X',
        firstPaymentConfirmedAt: 'bad',
        baseAmount: { amount: 1, currency: 'XAF' },
      }),
    ).toThrow(/firstPaymentConfirmedAt/);
  });

  it('rejects invalid money', () => {
    expect(() =>
      parseCreateCommissionBody({
        agentId,
        coreCustomerId: 'X',
        firstPaymentConfirmedAt: '2026-01-01',
        baseAmount: { amount: 1.5, currency: 'XAF' },
      }),
    ).toThrow(/baseAmount/);
    expect(() =>
      parseCreateCommissionBody({
        agentId,
        coreCustomerId: 'X',
        firstPaymentConfirmedAt: '2026-01-01',
        baseAmount: { amount: 1, currency: 'XYZ' },
      }),
    ).toThrow(/currency/);
  });
});

describe('parseReverseCommissionBody', () => {
  it('requires a reason', () => {
    expect(() => parseReverseCommissionBody({})).toThrow(/reason/);
    expect(parseReverseCommissionBody({ reason: 'Duplicate entry' })).toEqual({
      reason: 'Duplicate entry',
    });
  });
});

describe('parseListCommissionsQuery', () => {
  it('defaults page and limit', () => {
    const q = parseListCommissionsQuery(new URL('http://x/api/commissions'));
    expect(q.page).toBe(1);
    expect(q.limit).toBe(10);
    expect(q.agentId).toBeUndefined();
    expect(q.status).toBeUndefined();
    expect(q.period).toBeUndefined();
  });

  it('parses filters', () => {
    const q = parseListCommissionsQuery(
      new URL(`http://x/?agentId=${agentId}&status=APPROVED&period=2026-09`),
    );
    expect(q.agentId).toBe(agentId);
    expect(q.status).toBe('APPROVED');
    expect(q.period).toBe('2026-09');
  });

  it('rejects invalid filters', () => {
    expect(() => parseListCommissionsQuery(new URL('http://x/?status=WHATEVER'))).toThrow(/status/);
    expect(() => parseListCommissionsQuery(new URL('http://x/?period=2026/09'))).toThrow(/period/);
    expect(() => parseListCommissionsQuery(new URL('http://x/?limit=7'))).toThrow(/limit/);
  });
});
