import { connectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { hashPassword } from './password';
import { logger } from '../logging';

/**
 * Outcome of a bootstrap attempt. Never thrown — always returned.
 * Callers (instrumentation.ts) log and move on.
 */
export type BootstrapResult =
  | { seeded: true }
  | { seeded: false; reason: 'missing-env' | 'invalid-email' | 'invalid-password' | 'exists' | 'error' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

/**
 * Seeds exactly one admin from BOOTSTRAP_ADMIN_EMAIL / _PASSWORD / _NAME.
 *
 * Idempotent:
 *   - If any env var is missing, returns without writing (config issue).
 *   - If an Admin with that email already exists, returns without writing.
 *   - If two serverless instances race, the unique index on email causes
 *     the second create to fail, which we treat as "exists".
 *
 * Never rotates a stored password: changing BOOTSTRAP_ADMIN_PASSWORD in env
 * after the admin exists does NOT update the hash. Password changes are an
 * explicit action later (Phase 8 admin UI or a one-off script).
 *
 * Never throws — instrumentation.ts must not crash on config problems.
 */
export async function seedBootstrapAdmin(): Promise<BootstrapResult> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

  console.log('[bootstrap-admin] env check', {
    emailLen: email?.length,
    nameLen: name?.length,
    pwLen: password?.length,
  });

  if (!email || !password || !name) {
    return { seeded: false, reason: 'missing-env' };
  }
  if (!EMAIL_RE.test(email)) {
    return { seeded: false, reason: 'invalid-email' };
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
    return { seeded: false, reason: 'invalid-password' };
  }

  try {
    await connectDb();

    const existing = await Admin.findOne({ email }).lean<{ _id: unknown }>();
    if (existing) {
      return { seeded: false, reason: 'exists' };
    }

    const passwordHash = await hashPassword(password);
    try {
      await Admin.create({ email, name, passwordHash });
      return { seeded: true };
    } catch (err) {
      // Duplicate-key race with another cold-start instance.
      if (isDuplicateKeyError(err)) {
        return { seeded: false, reason: 'exists' };
      }
      throw err;
    }
  } catch (err) {
    // Log but never propagate — bootstrap must not take down the server.
    logger.error('bootstrap admin unexpected error', { err });
    return { seeded: false, reason: 'error' };
  }
}

/** Narrow a MongoDB duplicate-key error (code 11000) without using `any`. */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}