import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { Agent } from '../agent.model';

const regionId = new Types.ObjectId();

const base = {
  fullName: 'Awa Ngwa',
  type: 'AGENT' as const,
  email: 'AWA@example.com',
  phone: '+237600000000',
  regionId,
  referralCode: 'awa01',
  payoutPreference: { method: 'MOBILE_MONEY' as const, provider: 'MTN MoMo' },
};

describe('Agent schema', () => {
  it('accepts a valid agent and normalizes email/referralCode', async () => {
    const a = new Agent(base);
    await a.validate();
    expect(a.email).toBe('awa@example.com');
    expect(a.referralCode).toBe('AWA01');
    expect(a.status).toBe('ACTIVE');
    expect(a.payoutPreference.isDefault).toBe(true);
  });

  it('rejects an invalid type', async () => {
    const a = new Agent({ ...base, type: 'STAFF' as never });
    await expect(a.validate()).rejects.toThrow(/type/);
  });

  it('rejects an invalid status', async () => {
    const a = new Agent({ ...base, status: 'FIRED' as never });
    await expect(a.validate()).rejects.toThrow(/status/);
  });

  it('requires a payout method', async () => {
    const a = new Agent({ ...base, payoutPreference: {} });
    await expect(a.validate()).rejects.toThrow(/method/);
  });

  it('rejects an invalid payout method', async () => {
    const a = new Agent({
      ...base,
      payoutPreference: { method: 'CRYPTO' as never },
    });
    await expect(a.validate()).rejects.toThrow(/method/);
  });

  it('requires regionId, email, phone, referralCode, fullName', async () => {
    for (const field of ['fullName', 'email', 'phone', 'regionId', 'referralCode'] as const) {
      const a = new Agent({ ...base, [field]: undefined });
      await expect(a.validate()).rejects.toThrow();
    }
  });

  // Inside the existing describe('Agent schema'):
  it('defaults onboardingStage to REGISTERED and rejects invalid values', async () => {
    const a = new Agent(base);
    await a.validate();
    expect(a.onboardingStage).toBe('REGISTERED');

    const bad = new Agent({ ...base, onboardingStage: 'DONE' as never });
    await expect(bad.validate()).rejects.toThrow(/onboardingStage/);
  });

  it('defaults commissionRate to 500 bp and enforces bounds', async () => {
    const a = new Agent(base);
    await a.validate();
    expect(a.commissionRate).toBe(500);

    const tooHigh = new Agent({ ...base, commissionRate: 10001 });
    await expect(tooHigh.validate()).rejects.toThrow(/commissionRate/);

    const negative = new Agent({ ...base, commissionRate: -1 });
    await expect(negative.validate()).rejects.toThrow(/commissionRate/);
  });
});
