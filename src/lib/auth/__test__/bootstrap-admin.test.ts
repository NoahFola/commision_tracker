import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { connectDb, disconnectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { seedBootstrapAdmin } from '../bootstrap-admin';
import { verifyPassword } from '../password';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('seedBootstrapAdmin', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeAll(async () => {
    await connectDb();
  });

  afterAll(async () => {
    // Intentionally do NOT disconnect — the connection is shared across
    // test files in the worker. See vitest.setup.ts.
  });

  beforeEach(async () => {
    await Admin.deleteMany({});
    process.env = { ...ORIGINAL_ENV };
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.BOOTSTRAP_ADMIN_NAME;
    vi.restoreAllMocks();
  });

  const setEnv = (email?: string, password?: string, name?: string) => {
    if (email !== undefined) process.env.BOOTSTRAP_ADMIN_EMAIL = email;
    if (password !== undefined) process.env.BOOTSTRAP_ADMIN_PASSWORD = password;
    if (name !== undefined) process.env.BOOTSTRAP_ADMIN_NAME = name;
  };

  it('returns missing-env when vars are absent', async () => {
    const r = await seedBootstrapAdmin();
    expect(r).toEqual({ seeded: false, reason: 'missing-env' });
    expect(await Admin.countDocuments({})).toBe(0);
  });

  it('rejects a malformed email', async () => {
    setEnv('not-an-email', 'longenoughpassword', 'Ops');
    const r = await seedBootstrapAdmin();
    expect(r).toEqual({ seeded: false, reason: 'invalid-email' });
    expect(await Admin.countDocuments({})).toBe(0);
  });

  it('rejects a short password', async () => {
    setEnv('a@b.cm', 'short', 'Ops');
    const r = await seedBootstrapAdmin();
    expect(r).toEqual({ seeded: false, reason: 'invalid-password' });
    expect(await Admin.countDocuments({})).toBe(0);
  });

  it('creates an admin and stores a verifiable bcrypt hash', async () => {
    setEnv('Admin@Example.cm', 'a-very-strong-password', 'Ops Lead');
    const r = await seedBootstrapAdmin();
    expect(r).toEqual({ seeded: true });

    const admin = await Admin.findOne({ email: 'admin@example.cm' }).lean<{
      email: string;
      name: string;
      passwordHash?: string;
    }>();
    expect(admin).not.toBeNull();
    expect(admin?.name).toBe('Ops Lead');
    expect(admin?.passwordHash).toBeDefined();
    expect(await verifyPassword('a-very-strong-password', admin!.passwordHash!)).toBe(true);
  });

  it('is idempotent: second run returns exists, still one admin', async () => {
    setEnv('a@b.cm', 'a-very-strong-password', 'Ops');
    await seedBootstrapAdmin();
    const second = await seedBootstrapAdmin();
    expect(second).toEqual({ seeded: false, reason: 'exists' });
    expect(await Admin.countDocuments({})).toBe(1);
  });

  it('does NOT rotate the stored hash when the env password changes', async () => {
    setEnv('a@b.cm', 'first-strong-password', 'Ops');
    await seedBootstrapAdmin();
    const before = await Admin.findOne({ email: 'a@b.cm' }).lean<{ passwordHash: string }>();

    setEnv('a@b.cm', 'different-strong-password', 'Ops');
    const r = await seedBootstrapAdmin();
    expect(r).toEqual({ seeded: false, reason: 'exists' });

    const after = await Admin.findOne({ email: 'a@b.cm' }).lean<{ passwordHash: string }>();
    expect(after?.passwordHash).toBe(before?.passwordHash);
    expect(await verifyPassword('first-strong-password', after!.passwordHash)).toBe(true);
    expect(await verifyPassword('different-strong-password', after!.passwordHash)).toBe(false);
  });
});
