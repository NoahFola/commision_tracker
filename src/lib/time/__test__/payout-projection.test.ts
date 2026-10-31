import { describe, it, expect } from 'vitest';
import { nextPayoutProjection } from '../payout-projection';

describe('nextPayoutProjection', () => {
  it('projects to the last day of the following month', () => {
    // 15 Sep 2026 UTC = 15 Sep 2026 WAT → last day of Oct 2026 = 31 Oct.
    const result = nextPayoutProjection(new Date('2026-09-15T12:00:00Z'));
    expect(result.iso).toBe('2026-10-31');
    expect(result.display).toBe('31 Oct 2026');
  });

  it('rolls over across a December-to-January boundary', () => {
    // 15 Dec 2026 UTC = Dec 2026 WAT → last day of Jan 2027 = 31 Jan.
    const result = nextPayoutProjection(new Date('2026-12-15T12:00:00Z'));
    expect(result.iso).toBe('2027-01-31');
    expect(result.display).toBe('31 Jan 2027');
  });

  it('handles February (non-leap)', () => {
    // 15 Jan 2027 UTC = Jan 2027 WAT → last day of Feb 2027 = 28 Feb.
    const result = nextPayoutProjection(new Date('2027-01-15T12:00:00Z'));
    expect(result.iso).toBe('2027-02-28');
  });

  it('handles February (leap year)', () => {
    // 15 Jan 2028 UTC = Jan 2028 WAT → last day of Feb 2028 = 29 Feb.
    const result = nextPayoutProjection(new Date('2028-01-15T12:00:00Z'));
    expect(result.iso).toBe('2028-02-29');
  });

  it('respects the WAT boundary (late UTC on 30 Nov = 1 Dec WAT)', () => {
    // 30 Nov 2026 23:30 UTC = 1 Dec 2026 WAT → last day of Jan 2027 = 31 Jan.
    const result = nextPayoutProjection(new Date('2026-11-30T23:30:00Z'));
    expect(result.iso).toBe('2027-01-31');
    expect(result.display).toBe('31 Jan 2027');
  });
});
