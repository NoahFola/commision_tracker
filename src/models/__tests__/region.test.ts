import { describe, it, expect } from 'vitest';
import { Region } from '../region.model';

describe('Region schema', () => {
  it('requires name and normalizes nameKey', async () => {
    const r = new Region({ name: '  Douala  ' });
    await r.validate();
    expect(r.name).toBe('Douala');
    expect(r.nameKey).toBe('douala');
  });

  it('defaults isActive to true', () => {
    const r = new Region({ name: 'Yaoundé' });
    expect(r.isActive).toBe(true);
  });

  it('rejects a missing name', async () => {
    const r = new Region({});
    await expect(r.validate()).rejects.toThrow(/name/);
  });

  it('uppercases code', () => {
    const r = new Region({ name: 'Bafoussam', code: 'baf' });
    expect(r.code).toBe('BAF');
  });
});
