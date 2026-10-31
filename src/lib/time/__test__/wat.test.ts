import { describe, expect, it } from 'vitest';
import {
  assertDayKey,
  watDayKey,
  watDayStart,
  watDayToDate,
  watPeriod,
  watWeekStart,
} from '../wat';

describe('WAT helpers', () => {
  it('watDayStart returns 00:00 WAT of the containing day', () => {
    // 2026-09-30T02:00:00Z = 03:00 WAT on 2026-09-30 → day start = 2026-09-29T23:00:00Z
    const d = new Date('2026-09-30T02:00:00.000Z');
    expect(watDayStart(d).toISOString()).toBe('2026-09-29T23:00:00.000Z');
  });

  it('watDayStart is stable for a time near the WAT midnight boundary', () => {
    // 2026-09-29T22:59:59Z = 23:59:59 WAT on 2026-09-29 → still 2026-09-28T23:00:00Z
    const beforeMidnight = new Date('2026-09-29T22:59:59.000Z');
    expect(watDayStart(beforeMidnight).toISOString()).toBe('2026-09-28T23:00:00.000Z');
    // 2026-09-29T23:00:00Z = 00:00 WAT on 2026-09-30 → 2026-09-29T23:00:00Z
    const atMidnight = new Date('2026-09-29T23:00:00.000Z');
    expect(watDayStart(atMidnight).toISOString()).toBe('2026-09-29T23:00:00.000Z');
  });

  it('watDayKey and watPeriod reflect the WAT calendar day/month', () => {
    expect(watDayKey(new Date('2026-09-30T02:00:00.000Z'))).toBe('2026-09-30');
    // 2026-09-30T23:30:00Z = 00:30 WAT on 2026-10-01 → month rolls to October
    expect(watDayKey(new Date('2026-09-30T23:30:00.000Z'))).toBe('2026-10-01');
    expect(watPeriod(new Date('2026-09-30T23:30:00.000Z'))).toBe('2026-10');
  });

  it('watPeriod pads single-digit months', () => {
    expect(watPeriod(new Date('2026-01-15T12:00:00.000Z'))).toBe('2026-01');
  });
});

describe('watDayToDate', () => {
  it('returns UTC Date at WAT midnight for the given day key', () => {
    // WAT midnight on 2026-09-30 == 2026-09-29T23:00:00Z
    expect(watDayToDate('2026-09-30').toISOString()).toBe('2026-09-29T23:00:00.000Z');
  });

  it('round-trips with watDayKey', () => {
    for (const key of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      const d = watDayToDate(key);
      expect(watDayKey(d)).toBe(key);
    }
  });

  it('throws on malformed input', () => {
    expect(() => watDayToDate('30-09-2026')).toThrow();
    expect(() => watDayToDate('2026/09/30')).toThrow();
  });
});

describe('watWeekStart', () => {
  it('returns the Monday of the same week', () => {
    // 2026-09-30 is a Wednesday. Monday is 2026-09-28.
    expect(watWeekStart('2026-09-30')).toBe('2026-09-28');
  });

  it('is stable for a Monday input', () => {
    expect(watWeekStart('2026-09-28')).toBe('2026-09-28');
  });

  it('rolls back to the previous Monday for a Sunday input', () => {
    // 2026-10-04 is a Sunday. Monday of that week is 2026-09-28.
    expect(watWeekStart('2026-10-04')).toBe('2026-09-28');
  });

  it('crosses month boundaries correctly', () => {
    // 2026-11-01 is a Sunday. Monday is 2026-10-26.
    expect(watWeekStart('2026-11-01')).toBe('2026-10-26');
  });
});

describe('assertDayKey', () => {
  it('accepts well-formed keys and rejects others', () => {
    expect(() => assertDayKey('2026-09-30')).not.toThrow();
    expect(() => assertDayKey('2026-9-30')).toThrow();
    expect(() => assertDayKey('not-a-date')).toThrow();
  });
});
