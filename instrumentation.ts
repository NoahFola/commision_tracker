import { logger } from '@/lib/logging';

/**
 * Next.js instrumentation hook — runs ONCE per server process,
 * before any request is handled. This is the correct place for
 * one-shot startup work that must not run per-render.
 *
 * Currently:
 *   1. Warm the MongoDB connection.
 *   2. Seed the bootstrap admin from env vars (idempotent).
 *
 * Do NOT put DB calls in layout.tsx / page.tsx.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { connectDb } = await import('@/lib/db/mongoose');
    await connectDb();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      logger.error('db connection failed at boot', { err });
    }
  }

  try {
    const { seedBootstrapAdmin } = await import('@/lib/auth/bootstrap-admin');
    const result = await seedBootstrapAdmin();
    if (result.seeded) {
      logger.info('bootstrap admin seeded from env');
    } else if (result.reason === 'missing-env') {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('bootstrap admin skipped: BOOTSTRAP_ADMIN_* env vars not all set');
      }
    } else if (result.reason === 'exists') {
      logger.info('bootstrap admin already exists; skipped');
    } else {
      logger.warn('bootstrap admin skipped', { reason: result.reason });
    }
  } catch (err) {
    logger.error('bootstrap admin unexpected error', { err });
  }
}
