import { describe, it, expect } from 'vitest';
import { parseLoginBody } from '../auth';

describe('parseLoginBody', () => {
  it('accepts and normalizes a valid body', () => {
    expect(parseLoginBody({ email: '  A@B.cm ', password: 'x' })).toEqual({
      email: 'a@b.cm',
      password: 'x',
    });
  });

  it('rejects a non-object body', () => {
    expect(() => parseLoginBody(null)).toThrow();
    expect(() => parseLoginBody('string')).toThrow();
    expect(() => parseLoginBody(42)).toThrow();
  });

  it('rejects missing or non-string fields', () => {
    expect(() => parseLoginBody({})).toThrow();
    expect(() => parseLoginBody({ email: 1, password: 'x' })).toThrow();
    expect(() => parseLoginBody({ email: 'a@b.cm' })).toThrow();
  });

  it('rejects malformed email', () => {
    expect(() => parseLoginBody({ email: 'no-at-sign', password: 'x' })).toThrow();
  });

  it('rejects empty password', () => {
    expect(() => parseLoginBody({ email: 'a@b.cm', password: '' })).toThrow();
  });
});
