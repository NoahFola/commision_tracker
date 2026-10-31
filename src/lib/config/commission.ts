/**
 * Commission policy constants.
 *
 * These are the numbers that appear in every commission calculation.
 * They are code constants, not database records, on purpose: a change
 * to the platform fee is a policy decision that should go through review,
 * not a config edit at runtime.
 */

/** Platform fee withheld from every commission, in basis points. 500 = 5.00%. */
export const PLATFORM_FEE_RATE_BP = 500;

/** Minimum and maximum allowed commission rate for an agent, in basis points. */
export const MIN_COMMISSION_RATE_BP = 0;
export const MAX_COMMISSION_RATE_BP = 10000;

/** Default commission rate applied when an Agent is created without one. */
export const DEFAULT_COMMISSION_RATE_BP = 500;

/** Basis-point divisor. 10000 bp = 100%. */
export const BP_DIVISOR = 10000;
