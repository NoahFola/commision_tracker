import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  parseCreateBatchBody,
  parseListBatchesQuery,
  parseMarkPaidBody,
  parseFailBatchBody,
  parseBatchIdParam,
} from '../payout-batch';

const agentId = new Types.ObjectId().toHexString();

describe('parseCreateBatchBody', () => {
  it('accepts a minimal body', () => {
    const b = parseCreateBatchBody({ agentId, period: '2026-09' });
    expect(b).toEqual({ agentId, period: '2026-09', method: undefined });
  });

  it('accepts a method override', () => {
    expect(parseCreateBatchBody({ agentId, period: '2026-09', method: 'BANK' }).method).toBe(
      'BANK',
    );
  });

  it('rejects malformed inputs', () => {
    expect(() => parseCreateBatchBody({ period: '2026-09' })).toThrow(/agentId/);
    expect(() => parseCreateBatchBody({ agentId, period: 'bad' })).toThrow(/period/);
    expect(() => parseCreateBatchBody({ agentId, period: '2026-09', method: 'CRYPTO' })).toThrow(
      /method/,
    );
  });
});

describe('parseListBatchesQuery', () => {
  it('defaults page and limit', () => {
    const q = parseListBatchesQuery(new URL('http://x/api/payout-batches'));
    expect(q.page).toBe(1);
    expect(q.limit).toBe(10);
  });

  it('parses filters', () => {
    const q = parseListBatchesQuery(
      new URL(`http://x/?agentId=${agentId}&status=APPROVED&period=2026-09`),
    );
    expect(q.agentId).toBe(agentId);
    expect(q.status).toBe('APPROVED');
    expect(q.period).toBe('2026-09');
  });

  it('rejects invalid filters', () => {
    expect(() => parseListBatchesQuery(new URL('http://x/?status=WHATEVER'))).toThrow(/status/);
    expect(() => parseListBatchesQuery(new URL('http://x/?period=2026/09'))).toThrow(/period/);
    expect(() => parseListBatchesQuery(new URL('http://x/?limit=7'))).toThrow(/limit/);
  });
});

describe('parseMarkPaidBody', () => {
  it('accepts a reference', () => {
    expect(parseMarkPaidBody({ paymentReference: 'MOMO-12345' })).toEqual({
      paymentReference: 'MOMO-12345',
    });
  });

  it('accepts an empty body (used for CASH)', () => {
    expect(parseMarkPaidBody({})).toEqual({});
  });

  it('rejects a non-string reference', () => {
    expect(() => parseMarkPaidBody({ paymentReference: 123 })).toThrow(/paymentReference/);
  });
});

describe('parseFailBatchBody', () => {
  it('requires a reason', () => {
    expect(() => parseFailBatchBody({})).toThrow(/reason/);
    expect(parseFailBatchBody({ reason: 'Wrong MoMo number' })).toEqual({
      reason: 'Wrong MoMo number',
    });
  });
});

describe('parseBatchIdParam', () => {
  it('accepts a well-formed ObjectId', () => {
    expect(parseBatchIdParam(agentId)).toBe(agentId);
  });

  it('rejects malformed', () => {
    expect(() => parseBatchIdParam('not-an-id')).toThrow();
    expect(() => parseBatchIdParam('')).toThrow();
  });
});
