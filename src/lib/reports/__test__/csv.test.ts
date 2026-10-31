import { describe, it, expect } from 'vitest';
import { toCsv, csvDate, csvTimestampSuffix } from '../csv';

describe('toCsv', () => {
  it('produces headers and rows with \\r\\n', () => {
    const csv = toCsv(
      ['a', 'b'],
      [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ],
    );
    expect(csv).toBe('a,b\r\n1,2\r\n3,4\r\n');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const csv = toCsv(
      ['a', 'b'],
      [
        { a: 'x,y', b: 'has "quote"' },
        { a: 'multi\nline', b: 'plain' },
      ],
    );
    expect(csv).toContain('"x,y","has ""quote"""');
    expect(csv).toContain('"multi\nline",plain');
  });

  it('treats null and undefined as empty', () => {
    const csv = toCsv(['a', 'b'], [{ a: null, b: undefined }]);
    expect(csv).toBe('a,b\r\n,\r\n');
  });

  it('ignores unknown keys', () => {
    const csv = toCsv(['a'], [{ a: 1, z: 999 } as never]);
    expect(csv).toBe('a\r\n1\r\n');
  });
});

describe('csvDate', () => {
  it('formats dates as ISO strings', () => {
    expect(csvDate(new Date('2026-09-15T10:00:00Z'))).toBe('2026-09-15T10:00:00.000Z');
    expect(csvDate('already-a-string')).toBe('already-a-string');
    expect(csvDate(null)).toBe('');
    expect(csvDate(undefined)).toBe('');
  });
});

describe('csvTimestampSuffix', () => {
  it('is filename-safe', () => {
    const s = csvTimestampSuffix(new Date('2026-09-15T10:20:30Z'));
    expect(s).toBe('20260915-102030');
  });
});
