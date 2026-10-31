import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  MAX_RANGE_DAYS,
  parseAggregatePerformanceQuery,
  parseCreatePerformanceBody,
  parseListPerformanceQuery,
} from '../performance';

const agentId = new Types.ObjectId().toHexString();

describe('parseCreatePerformanceBody', () => {
  it('accepts a minimal body and defaults counters and money', () => {
    const body = parseCreatePerformanceBody({ agentId, dayKey: '2026-09-30' });
    expect(body.leadsGenerated).toBe(0);
    expect(body.dealsClosed).toBe(0);
    expect(body.revenueAttributed).toEqual({ amount: 0, currency: 'XAF' });
    expect(body.supersedesId).toBeUndefined();
  });

  it('requires a valid agentId and dayKey', () => {
    expect(() => parseCreatePerformanceBody({ dayKey: '2026-09-30' })).toThrow(/agentId/);
    expect(() => parseCreatePerformanceBody({ agentId })).toThrow(/dayKey/);
    expect(() => parseCreatePerformanceBody({ agentId, dayKey: '30-09-2026' })).toThrow(/dayKey/);
  });

  it('rejects negative or non-integer counters', () => {
    expect(() =>
      parseCreatePerformanceBody({ agentId, dayKey: '2026-09-30', leadsGenerated: -1 }),
    ).toThrow(/leadsGenerated/);
    expect(() =>
      parseCreatePerformanceBody({ agentId, dayKey: '2026-09-30', dealsClosed: 1.5 }),
    ).toThrow(/dealsClosed/);
  });

  it('requires reason when supersedesId is set', () => {
    const supersedesId = new Types.ObjectId().toHexString();
    expect(() =>
      parseCreatePerformanceBody({ agentId, dayKey: '2026-09-30', supersedesId }),
    ).toThrow(/reason/);
    expect(() =>
      parseCreatePerformanceBody({
        agentId,
        dayKey: '2026-09-30',
        supersedesId,
        reason: 'Correction',
      }),
    ).not.toThrow();
  });

  it('validates money shape', () => {
    expect(() =>
      parseCreatePerformanceBody({
        agentId,
        dayKey: '2026-09-30',
        revenueAttributed: { amount: 1.5, currency: 'XAF' },
      }),
    ).toThrow(/amount/);
    expect(() =>
      parseCreatePerformanceBody({
        agentId,
        dayKey: '2026-09-30',
        revenueAttributed: { amount: 100, currency: 'XYZ' },
      }),
    ).toThrow(/currency/);
  });
});

describe('parseListPerformanceQuery', () => {
  it('uses defaults when no query params', () => {
    const q = parseListPerformanceQuery(new URL('http://x/api/performance'));
    expect(q.page).toBe(1);
    expect(q.limit).toBe(10);
    expect(q.onlyCurrent).toBe(true);
    // Default range covers roughly the last 30 days.
    expect(q.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('honours onlyCurrent=false', () => {
    const q = parseListPerformanceQuery(new URL('http://x/?onlyCurrent=false'));
    expect(q.onlyCurrent).toBe(false);
  });

  it('rejects malformed dates and invalid page sizes', () => {
    expect(() => parseListPerformanceQuery(new URL('http://x/?from=bad'))).toThrow(/from/);
    expect(() => parseListPerformanceQuery(new URL('http://x/?limit=7'))).toThrow(/limit/);
  });
});

describe('parseAggregatePerformanceQuery', () => {
  it('defaults to daily', () => {
    const q = parseAggregatePerformanceQuery(new URL('http://x/api/performance/aggregate'));
    expect(q.granularity).toBe('daily');
  });

  it('accepts weekly and monthly', () => {
    expect(
      parseAggregatePerformanceQuery(new URL('http://x/?granularity=weekly')).granularity,
    ).toBe('weekly');
    expect(
      parseAggregatePerformanceQuery(new URL('http://x/?granularity=monthly')).granularity,
    ).toBe('monthly');
  });

  it('rejects invalid granularity', () => {
    expect(() => parseAggregatePerformanceQuery(new URL('http://x/?granularity=hourly'))).toThrow(
      /granularity/,
    );
  });
});

describe('range cap', () => {
  it('accepts a range exactly at the cap', () => {
    // from 2026-01-01, to 2026-12-31 in a non-leap year is 365 days;
    // 2026-01-01 -> 2026-12-31 + 1 day back = 365 inclusive. Let me be
    // explicit: from 2026-01-01, to 2026-12-31 inclusive is 365 days.
    // A 366-day inclusive range is 2026-01-01 -> 2027-01-01.
    const q = parseListPerformanceQuery(new URL('http://x/?from=2026-01-01&to=2027-01-01'));
    expect(q.from).toBe('2026-01-01');
    expect(q.to).toBe('2027-01-01');
  });

  it('rejects a range one day over the cap', () => {
    // from 2026-01-01 to 2027-01-02 inclusive is 367 days.
    expect(() =>
      parseListPerformanceQuery(new URL('http://x/?from=2026-01-01&to=2027-01-02')),
    ).toThrow(/range/i);
  });

  it('rejects absurdly large ranges', () => {
    expect(() =>
      parseAggregatePerformanceQuery(new URL('http://x/?from=2000-01-01&to=2030-01-01')),
    ).toThrow(/range/i);
  });

  it('rejects to < from', () => {
    expect(() =>
      parseListPerformanceQuery(new URL('http://x/?from=2026-06-01&to=2026-05-01')),
    ).toThrow(/to must be/i);
  });

  it('applies the cap to the aggregate endpoint too', () => {
    expect(() =>
      parseAggregatePerformanceQuery(new URL(`http://x/?from=2026-01-01&to=2027-01-03`)),
    ).toThrow(/range/i);
  });

  it('MAX_RANGE_DAYS is 366', () => {
    expect(MAX_RANGE_DAYS).toBe(366);
  });
});