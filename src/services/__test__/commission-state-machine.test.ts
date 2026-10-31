import { describe, it, expect } from 'vitest';
import {
  assertValidCommissionTransition,
  nextCommissionStatus,
  canReverseCommission,
} from '../commission.service';



describe('commission state machine', () => {
  it('allows only forward transitions', () => {
    expect(() => assertValidCommissionTransition('PENDING', 'VERIFIED')).not.toThrow();
    expect(() => assertValidCommissionTransition('VERIFIED', 'APPROVED')).not.toThrow();
    expect(() => assertValidCommissionTransition('APPROVED', 'PAID')).not.toThrow();
  });

  it('rejects backward and skipping transitions', () => {
    expect(() => assertValidCommissionTransition('VERIFIED', 'PENDING')).toThrow();
    expect(() => assertValidCommissionTransition('APPROVED', 'VERIFIED')).toThrow();
    expect(() => assertValidCommissionTransition('PAID', 'APPROVED')).toThrow();
    expect(() => assertValidCommissionTransition('PENDING', 'APPROVED')).toThrow();
    expect(() => assertValidCommissionTransition('PENDING', 'PAID')).toThrow();
  });

  it('rejects self-transitions', () => {
    expect(() => assertValidCommissionTransition('PENDING', 'PENDING')).toThrow();
    expect(() => assertValidCommissionTransition('PAID', 'PAID')).toThrow();
  });

  it('nextCommissionStatus walks the chain', () => {
    expect(nextCommissionStatus('PENDING')).toBe('VERIFIED');
    expect(nextCommissionStatus('VERIFIED')).toBe('APPROVED');
    expect(nextCommissionStatus('APPROVED')).toBe('PAID');
    expect(() => nextCommissionStatus('PAID')).toThrow();
  });

  it('canReverseCommission is false only for PAID', () => {
    expect(canReverseCommission('PENDING')).toBe(true);
    expect(canReverseCommission('VERIFIED')).toBe(true);
    expect(canReverseCommission('APPROVED')).toBe(true);
    expect(canReverseCommission('PAID')).toBe(false);
  });
});
