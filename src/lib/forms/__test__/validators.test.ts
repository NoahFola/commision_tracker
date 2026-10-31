import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateReferralCode,
  validatePeriod,
  validateBaseAmount,
  validatePassword,
  firstError,
} from '../validators';

describe('validateEmail', () => {
  it('accepts a valid email', () => {
    expect(validateEmail('a@b.cm')).toBeNull();
    expect(validateEmail('  a@b.cm  ')).toBeNull();
  });
  it('rejects an empty or malformed email', () => {
    expect(validateEmail('')).toMatch(/required/);
    expect(validateEmail('not-an-email')).toMatch(/valid email/);
  });
});

describe('validatePhone', () => {
  it('accepts common formats', () => {
    expect(validatePhone('+237 677 000 000')).toBeNull();
    expect(validatePhone('677000000')).toBeNull();
  });
  it('rejects a malformed phone', () => {
    expect(validatePhone('')).toMatch(/required/);
    expect(validatePhone('abc')).toMatch(/valid phone/);
  });
});

describe('validateRequired', () => {
  it('uses the provided label', () => {
    expect(validateRequired('', 'Full name')).toBe('Full name is required.');
    expect(validateRequired('  ', 'Full name')).toBe('Full name is required.');
    expect(validateRequired('x', 'Full name')).toBeNull();
  });
});

describe('validateReferralCode', () => {
  it('accepts uppercase letters and digits', () => {
    expect(validateReferralCode('AWA01')).toBeNull();
    expect(validateReferralCode('awa01')).toBeNull();
  });
  it('rejects short or invalid codes', () => {
    expect(validateReferralCode('')).toMatch(/required/);
    expect(validateReferralCode('A')).toMatch(/letters or digits/);
    expect(validateReferralCode('has spaces')).toMatch(/letters or digits/);
  });
});

describe('validatePeriod', () => {
  it('accepts YYYY-MM', () => {
    expect(validatePeriod('2026-09')).toBeNull();
  });
  it('rejects malformed periods', () => {
    expect(validatePeriod('')).toMatch(/required/);
    expect(validatePeriod('2026/09')).toMatch(/2026-09/);
    expect(validatePeriod('2026-9')).toMatch(/2026-09/);
  });
});

describe('validateBaseAmount', () => {
  it('accepts positive integers', () => {
    expect(validateBaseAmount('20000')).toBeNull();
    expect(validateBaseAmount('1')).toBeNull();
  });
  it('rejects zero, negatives, and decimals', () => {
    expect(validateBaseAmount('')).toMatch(/required/);
    expect(validateBaseAmount('0')).toMatch(/greater than zero/);
    expect(validateBaseAmount('-1')).toMatch(/greater than zero/);
    expect(validateBaseAmount('10.5')).toMatch(/whole number/);
    expect(validateBaseAmount('abc')).toMatch(/must be a number/);
  });
});

describe('validatePassword', () => {
  it('accepts a valid password', () => {
    expect(validatePassword('abcdefghij')).toBeNull();
  });
  it('rejects short and long passwords', () => {
    expect(validatePassword('')).toMatch(/required/);
    expect(validatePassword('short')).toMatch(/10 characters/);
    expect(validatePassword('x'.repeat(73))).toMatch(/72 characters/);
  });
});

describe('firstError', () => {
  it('returns the first failure in validator order', () => {
    const values = { email: '', phone: 'abc' };
    const validators = { email: validateEmail, phone: validatePhone };
    expect(firstError(values, validators)).toMatch(/Email is required/);
  });
  it('returns null when all pass', () => {
    const values = { email: 'a@b.cm', phone: '+237677000000' };
    const validators = { email: validateEmail, phone: validatePhone };
    expect(firstError(values, validators)).toBeNull();
  });
});
