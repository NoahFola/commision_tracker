import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { PerformanceEvent } from '../performance-event.model';

const base = {
  agentId: new Types.ObjectId(),
  dayKey: '2026-09-30',
  date: new Date('2026-09-29T23:00:00.000Z'), // WAT 00:00 on 2026-09-30
  revenueAttributed: { amount: 0, currency: 'XAF' as const },
  createdBy: new Types.ObjectId(),
};

describe('PerformanceEvent schema', () => {
  it('accepts a valid daily snapshot and defaults counters to 0', async () => {
    const p = new PerformanceEvent(base);
    await p.validate();
    expect(p.leadsGenerated).toBe(0);
    expect(p.dealsClosed).toBe(0);
    expect(p.supersedesId).toBeNull();
  });

  it('rejects a malformed dayKey', async () => {
    const p = new PerformanceEvent({ ...base, dayKey: '30-09-2026' });
    await expect(p.validate()).rejects.toThrow(/dayKey/);
  });

  it('rejects negative counters', async () => {
    const p = new PerformanceEvent({ ...base, leadsGenerated: -1 });
    await expect(p.validate()).rejects.toThrow(/leadsGenerated/);
  });

  it('rejects non-integer revenue', async () => {
    const p = new PerformanceEvent({
      ...base,
      revenueAttributed: { amount: 10.5, currency: 'XAF' },
    });
    await expect(p.validate()).rejects.toThrow();
  });

  it('requires a reason when superseding a prior row', async () => {
    const p = new PerformanceEvent({
      ...base,
      supersedesId: new Types.ObjectId(),
    });
    await expect(p.validate()).rejects.toThrow(/reason/);
  });

  it('accepts a superseding row with a reason', async () => {
    const p = new PerformanceEvent({
      ...base,
      supersedesId: new Types.ObjectId(),
      reason: 'Corrected deal count after verification',
    });
    await p.validate();
  });

  it('requires createdBy', async () => {
    const p = new PerformanceEvent({ ...base, createdBy: undefined });
    await expect(p.validate()).rejects.toThrow(/createdBy/);
  });
});
