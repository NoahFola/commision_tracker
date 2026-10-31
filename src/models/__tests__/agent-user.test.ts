import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { AgentUser } from '../agent-user.model';

const base = {
  agentId: new Types.ObjectId(),
  email: 'Agent@Example.cm',
  passwordHash: 'x'.repeat(40),
};

describe('AgentUser schema', () => {
  it('lowercases email and accepts a valid identity', async () => {
    const u = new AgentUser(base);
    await u.validate();
    expect(u.email).toBe('agent@example.cm');
  });

  it('requires agentId, email, passwordHash', async () => {
    for (const field of ['agentId', 'email', 'passwordHash'] as const) {
      const u = new AgentUser({ ...base, [field]: undefined });
      await expect(u.validate()).rejects.toThrow();
    }
  });

  it('rejects a short passwordHash', async () => {
    const u = new AgentUser({ ...base, passwordHash: 'short' });
    await expect(u.validate()).rejects.toThrow(/passwordHash/);
  });
});
