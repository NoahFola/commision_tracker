import { describe, it, expect } from 'vitest';
import {
  assertValidStatusTransition,
  assertValidOnboardingTransition,
} from '../agent.service';

describe('assertValidStatusTransition', () => {
  const allowed: Array<[string, string]> = [
    ['ACTIVE', 'ACTIVE'],
    ['ACTIVE', 'SUSPENDED'],
    ['ACTIVE', 'INACTIVE'],
    ['ACTIVE', 'TERMINATED'],
    ['SUSPENDED', 'ACTIVE'],
    ['SUSPENDED', 'SUSPENDED'],
    ['SUSPENDED', 'TERMINATED'],
    ['INACTIVE', 'ACTIVE'],
    ['INACTIVE', 'INACTIVE'],
    ['INACTIVE', 'TERMINATED'],
    ['TERMINATED', 'TERMINATED'],
  ];
  for (const [from, to] of allowed) {
    it(`allows ${from} -> ${to}`, () => {
      expect(() => assertValidStatusTransition(from as never, to as never)).not.toThrow();
    });
  }

  const rejected: Array<[string, string]> = [
    ['SUSPENDED', 'INACTIVE'],
    ['INACTIVE', 'SUSPENDED'],
    ['TERMINATED', 'ACTIVE'],
    ['TERMINATED', 'SUSPENDED'],
    ['TERMINATED', 'INACTIVE'],
  ];
  for (const [from, to] of rejected) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(() => assertValidStatusTransition(from as never, to as never)).toThrow();
    });
  }
});

describe('assertValidOnboardingTransition', () => {
  const allowed: Array<[string, string]> = [
    ['REGISTERED', 'REGISTERED'],
    ['REGISTERED', 'PROFILE_COMPLETE'],
    ['PROFILE_COMPLETE', 'PROFILE_COMPLETE'],
    ['PROFILE_COMPLETE', 'VERIFIED'],
    ['VERIFIED', 'VERIFIED'],
    ['VERIFIED', 'ONBOARDED'],
    ['ONBOARDED', 'ONBOARDED'],
  ];
  for (const [from, to] of allowed) {
    it(`allows ${from} -> ${to}`, () => {
      expect(() => assertValidOnboardingTransition(from as never, to as never)).not.toThrow();
    });
  }

  const rejected: Array<[string, string]> = [
    ['PROFILE_COMPLETE', 'REGISTERED'],
    ['VERIFIED', 'REGISTERED'],
    ['VERIFIED', 'PROFILE_COMPLETE'],
    ['ONBOARDED', 'VERIFIED'],
    ['ONBOARDED', 'REGISTERED'],
    ['REGISTERED', 'VERIFIED'],
    ['REGISTERED', 'ONBOARDED'],
    ['PROFILE_COMPLETE', 'ONBOARDED'],
  ];
  for (const [from, to] of rejected) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(() => assertValidOnboardingTransition(from as never, to as never)).toThrow();
    });
  }
});