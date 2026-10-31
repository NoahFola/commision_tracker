import bcrypt from 'bcryptjs';

/**
 * bcrypt cost factor.
 * Production default: 12.
 * Overridable via BCRYPT_COST env var — tests set a lower value
 * (see vitest.setup.ts) so each hash takes milliseconds instead of seconds.
 * Never set BCRYPT_COST lower than 10 in production.
 */
export const BCRYPT_COST = (() => {
  const raw = process.env.BCRYPT_COST;
  if (!raw) return 12;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 4 || n > 15) return 12;
  return n;
})();

export const MAX_PASSWORD_BYTES = 72;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash || typeof hash !== 'string') return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
