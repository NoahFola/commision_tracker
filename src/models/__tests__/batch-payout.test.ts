import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { PayoutBatch } from '../payout-batch.model';

const base = {
  agentId: new Types.ObjectId(),
  period: '2026-09',
  commissionIds: [new Types.ObjectId(), new Types.ObjectId()],
  totalAmount: { amount: 5000, currency: 'XAF' as const },
  method: 'MOBILE_MONEY' as const,
  createdBy: new Types.ObjectId(),
};

describe('PayoutBatch schema', () => {
  it('accepts a valid batch and defaults status to DRAFT', async () => {
    const b = new PayoutBatch(base);
    await b.validate();
    expect(b.status).toBe('DRAFT');
  });

  it('requires agentId, period, totalAmount, method, createdBy', async () => {
    for (const field of ['agentId', 'period', 'totalAmount', 'method', 'createdBy'] as const) {
      const b = new PayoutBatch({ ...base, [field]: undefined });
      await expect(b.validate()).rejects.toThrow();
    }
  });

  it('rejects a malformed period', async () => {
    const b = new PayoutBatch({ ...base, period: '2026/09' });
    await expect(b.validate()).rejects.toThrow(/period/);
  });

  it('rejects an invalid method', async () => {
    const b = new PayoutBatch({ ...base, method: 'CRYPTO' as never });
    await expect(b.validate()).rejects.toThrow(/method/);
  });

  it('rejects an invalid status', async () => {
    const b = new PayoutBatch({ ...base, status: 'BOGUS' as never });
    await expect(b.validate()).rejects.toThrow(/status/);
  });

  it('accepts a fractional totalAmount? NO — Money is integer', async () => {
    const b = new PayoutBatch({ ...base, totalAmount: { amount: 10.5, currency: 'XAF' } });
    await expect(b.validate()).rejects.toThrow();
  });
});
