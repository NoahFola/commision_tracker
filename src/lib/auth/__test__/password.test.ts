import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, BCRYPT_COST } from '../password';

describe('password', () => {
  it('round-trips a password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('right');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('returns false for a malformed hash rather than throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });

  it('uses the configured cost factor', async () => {
    const hash = await hashPassword('x');
    // bcrypt encodes cost as a two-digit field: $04$, $12$, etc.
    const twoDigit = String(BCRYPT_COST).padStart(2, '0');
    expect(hash).toContain(`$${twoDigit}$`);
  });
});
