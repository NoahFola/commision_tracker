import { BadRequestError } from '@/lib/errors/app-error';
import { BP_DIVISOR, PLATFORM_FEE_RATE_BP } from '@/lib/config/commission';
import type { Money } from './money';

/**
 * Pure commission math. No DB, no Mongoose, no service imports — this
 * module is safe to import from a client component (the New commission
 * form uses computeCommissionAmounts to preview gross/fee/net as the
 * admin types the base amount).
 *
 * The formulas must stay identical to what the server applies at
 * commission creation. The server remains the source of truth; this is
 * a preview, and the SidePanel copy says so.
 */

export type CommissionAmounts = {
  grossAmount: Money;
  platformFee: Money;
  netAmount: Money;
};

/**
 * Computes gross, platform fee, and net from a base amount and a rate,
 * using integer arithmetic throughout.
 *
 *   gross = floor(base * rateBp / BP_DIVISOR)
 *   fee   = floor(gross * platformFeeBp / BP_DIVISOR)
 *   net   = gross - fee
 *
 * Integer division rounds DOWN (floor). This favours the platform
 * slightly on fractional units, which is the conservative choice:
 * we never pay out more than the formula says we owe.
 */
export function computeCommissionAmounts(
  base: Money,
  rateBp: number,
  platformFeeBp: number = PLATFORM_FEE_RATE_BP,
): CommissionAmounts {
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > 10000) {
    throw new BadRequestError('rateBp must be an integer between 0 and 10000');
  }
  if (!Number.isInteger(platformFeeBp) || platformFeeBp < 0 || platformFeeBp > 10000) {
    throw new BadRequestError('platformFeeBp must be an integer between 0 and 10000');
  }
  if (!Number.isInteger(base.amount)) {
    throw new BadRequestError('base amount must be an integer');
  }

  const grossAmount = Math.floor((base.amount * rateBp) / BP_DIVISOR);
  const platformFee = Math.floor((grossAmount * platformFeeBp) / BP_DIVISOR);
  const netAmount = grossAmount - platformFee;

  return {
    grossAmount: { amount: grossAmount, currency: base.currency },
    platformFee: { amount: platformFee, currency: base.currency },
    netAmount: { amount: netAmount, currency: base.currency },
  };
}

/**
 * Negates the amounts of a commission to produce a reversal mirror.
 * All three fields flip sign; currency is preserved.
 */
export function negateAmounts(amounts: CommissionAmounts): CommissionAmounts {
  return {
    grossAmount: { amount: -amounts.grossAmount.amount, currency: amounts.grossAmount.currency },
    platformFee: { amount: -amounts.platformFee.amount, currency: amounts.platformFee.currency },
    netAmount: { amount: -amounts.netAmount.amount, currency: amounts.netAmount.currency },
  };
}