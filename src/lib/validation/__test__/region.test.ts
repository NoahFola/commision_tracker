import { describe, it, expect } from 'vitest';
import { parseCreateRegionBody, parseListRegionsQuery } from '../region';

describe('parseCreateRegionBody', () => {
  it('accepts a minimal body and trims/normalizes', () => {
    const b = parseCreateRegionBody({ name: '  Douala  ', code: 'dla' });
    expect(b.name).toBe('Douala');
    expect(b.code).toBe('DLA');
    expect(b.isActive).toBeUndefined();
  });

  it('rejects a missing or empty name', () => {
    expect(() => parseCreateRegionBody({})).toThrow(/name/);
    expect(() => parseCreateRegionBody({ name: '   ' })).toThrow(/name/);
  });

  it('rejects a non-boolean isActive', () => {
    expect(() => parseCreateRegionBody({ name: 'X', isActive: 'yes' })).toThrow(/isActive/);
  });

  it('rejects a non-object body', () => {
    expect(() => parseCreateRegionBody(null)).toThrow();
    expect(() => parseCreateRegionBody('region')).toThrow();
  });
});

describe('parseListRegionsQuery', () => {
  it('returns no filter when isActive is absent', () => {
    expect(parseListRegionsQuery(new URL('http://x/api/regions'))).toEqual({});
  });

  it('parses isActive=true and isActive=false', () => {
    expect(parseListRegionsQuery(new URL('http://x/?isActive=true'))).toEqual({
      isActive: true,
    });
    expect(parseListRegionsQuery(new URL('http://x/?isActive=false'))).toEqual({
      isActive: false,
    });
  });

  it('rejects anything else', () => {
    expect(() => parseListRegionsQuery(new URL('http://x/?isActive=maybe'))).toThrow(
      /isActive/,
    );
  });
});