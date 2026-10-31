import { Types } from 'mongoose';
import type { AuthMeAdmin, AuthMeAgent } from '@/types/auth';

/**
 * Test-only helpers for building AuthMe values.
 *
 * These exist so tests don't hand-write object literals that can drift
 * from the AuthMe type. When the type changes, this file changes once.
 *
 * Every call returns a fresh object with a fresh ObjectId.
 */
export function makeAdminUser(overrides: Partial<AuthMeAdmin> = {}): AuthMeAdmin {
  return {
    subjectType: 'ADMIN',
    subjectId: new Types.ObjectId().toHexString(),
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
    ...overrides,
  };
}

export function makeAgentUser(overrides: Partial<AuthMeAgent> = {}): AuthMeAgent {
  const id = new Types.ObjectId().toHexString();
  return {
    subjectType: 'AGENT',
    subjectId: id,
    email: 'agent@epsihome.cm',
    name: 'Awa',
    profilePictureUrl: null,
    roles: ['AGENT'],
    agentId: id,
    agentType: 'AGENT',
    referralCode: 'AWA01',
    ...overrides,
  };
}
