import { describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import { assertCanAccessAgent, scopeAgentFilter, isAdmin } from '../guards';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { AuthMeAdmin, AuthMeAgent } from '@/types/auth';

const adminUser: AuthMeAdmin = {
  subjectType: 'ADMIN',
  subjectId: '507f1f77bcf86cd799439011',
  email: 'a@b.cm',
  name: 'Ops',
  profilePictureUrl: null,
  roles: ['ADMIN'],
};

const agentUser: AuthMeAgent = {
  subjectType: 'AGENT',
  referralCode:'XXX',
  subjectId: '507f1f77bcf86cd799439012',
  email: 'awa@x.cm',
  name: 'Awa',
  profilePictureUrl: null,
  roles: ['AGENT'],
  agentId: '507f1f77bcf86cd799439012',
  agentType: 'AGENT',
};

describe('assertCanAccessAgent', () => {
  it('lets an admin access any agentId', () => {
    expect(() => assertCanAccessAgent(adminUser, new Types.ObjectId())).not.toThrow();
  });

  it('lets an agent access their own agentId', () => {
    expect(() => assertCanAccessAgent(agentUser, agentUser.agentId)).not.toThrow();
  });

  it('rejects an agent accessing another agentId', () => {
    const other = new Types.ObjectId().toHexString();
    expect(() => assertCanAccessAgent(agentUser, other)).toThrow(ForbiddenError);
  });
});

describe('scopeAgentFilter', () => {
  it('returns base filter unchanged for admin', () => {
    const base = { status: 'ACTIVE' as const };
    expect(scopeAgentFilter(adminUser, base)).toEqual(base);
  });

  it('narrows the filter to the agent own _id', () => {
    const filter = scopeAgentFilter(agentUser, { status: 'ACTIVE' as const });
    expect(String(filter._id)).toBe(agentUser.agentId);
    expect(filter.status).toBe('ACTIVE');
  });
});

describe('isAdmin', () => {
  it('is true only for admins', () => {
    expect(isAdmin(adminUser)).toBe(true);
    expect(isAdmin(agentUser)).toBe(false);
  });
});
