import { describe, it, expect } from 'vitest';
import { Admin } from '../admin.model';

describe('Admin schema', () => {
  it('requires email and name, lowercases email', async () => {
    const a = new Admin({ email: 'Admin@EpsiHome.cm', name: 'Ops Lead' });
    await a.validate();
    expect(a.email).toBe('admin@epsihome.cm');
  });

  it('rejects missing name', async () => {
    const a = new Admin({ email: 'x@y.z' });
    await expect(a.validate()).rejects.toThrow(/name/);
  });

  it('rejects missing email', async () => {
    const a = new Admin({ name: 'No Email' });
    await expect(a.validate()).rejects.toThrow(/email/);
  });
});
