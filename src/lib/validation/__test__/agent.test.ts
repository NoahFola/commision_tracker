import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  parseCreateAgentBody,
  parseUpdateAgentBody,
  parseListAgentsQuery,
  DEFAULT_PAGE_SIZE,
} from '../agent';

const regionId = new Types.ObjectId().toHexString();

const validCreate = {
  fullName: 'Awa Ngwa',
  type: 'AGENT' as const,
  email: 'AWA@Example.cm',
  phone: '+237600000000',
  regionId,
  referralCode: 'awa01',
  payoutPreference: { method: 'MOBILE_MONEY' as const, provider: 'MTN MoMo' },
  password: 'a-very-strong-password',
};

describe('parseCreateAgentBody', () => {
  it('accepts a valid body and normalizes email/referralCode', () => {
    const body = parseCreateAgentBody(validCreate);
    expect(body.email).toBe('awa@example.cm');
    expect(body.referralCode).toBe('AWA01');
    expect(body.password).toBe('a-very-strong-password');
  });

  it('rejects a short password', () => {
    expect(() => parseCreateAgentBody({ ...validCreate, password: 'short' })).toThrow(/password/);
  });

  it('rejects an invalid email', () => {
    expect(() => parseCreateAgentBody({ ...validCreate, email: 'not-an-email' })).toThrow(/email/);
  });

  it('rejects an invalid regionId', () => {
    expect(() => parseCreateAgentBody({ ...validCreate, regionId: 'nope' })).toThrow(/regionId/);
  });

  it('rejects an unknown type', () => {
    expect(() => parseCreateAgentBody({ ...validCreate, type: 'STAFF' })).toThrow(/type/);
  });

  it('rejects a missing payout method', () => {
    expect(() => parseCreateAgentBody({ ...validCreate, payoutPreference: {} })).toThrow(/method/);
  });
});

describe('parseUpdateAgentBody (PATCH)', () => {
  it('returns only the fields present in the body', () => {
    const body = parseUpdateAgentBody({ fullName: 'New Name' });
    expect(body).toEqual({ fullName: 'New Name' });
  });

  it('normalizes email and referralCode when present', () => {
    expect(parseUpdateAgentBody({ email: 'X@Y.cm' }).email).toBe('x@y.cm');
    expect(parseUpdateAgentBody({ referralCode: 'abc' }).referralCode).toBe('ABC');
  });

  it('validates enum fields when present', () => {
    expect(() => parseUpdateAgentBody({ status: 'FIRED' })).toThrow(/status/);
    expect(() => parseUpdateAgentBody({ onboardingStage: 'WHATEVER' })).toThrow(/onboardingStage/);
  });

  it('accepts an empty body', () => {
    expect(parseUpdateAgentBody({})).toEqual({});
  });
});

describe('parseListAgentsQuery', () => {
  it('defaults page=1, limit=10', () => {
    const q = parseListAgentsQuery(new URL('http://x/api/agents'));
    expect(q.page).toBe(1);
    expect(q.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it('accepts allowed page sizes only', () => {
    for (const size of [5, 10, 25, 30, 50]) {
      expect(parseListAgentsQuery(new URL(`http://x/?limit=${size}`)).limit).toBe(size);
    }
    expect(() => parseListAgentsQuery(new URL('http://x/?limit=7'))).toThrow(/limit/);
    expect(() => parseListAgentsQuery(new URL('http://x/?limit=0'))).toThrow(/limit/);
  });

  it('validates status/type/regionId when present', () => {
    const ok = parseListAgentsQuery(
      new URL(`http://x/?status=ACTIVE&type=AGENT&regionId=${regionId}`),
    );
    expect(ok.status).toBe('ACTIVE');
    expect(ok.type).toBe('AGENT');
    expect(ok.regionId).toBe(regionId);

    expect(() => parseListAgentsQuery(new URL('http://x/?status=DEAD'))).toThrow(/status/);
    expect(() => parseListAgentsQuery(new URL('http://x/?type=X'))).toThrow(/type/);
    expect(() => parseListAgentsQuery(new URL('http://x/?regionId=xx'))).toThrow(/regionId/);
  });
});
