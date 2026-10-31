/**
 * Migration runner.
 *
 *   npm run migrate                       list migrations and their status
 *   npm run migrate -- 2026-10-11-...     run one specific migration
 *   npm run migrate -- --all              run every pending migration
 *
 * Status is tracked in a `migrations` collection: one row per migration
 * that has been applied, with `name` and `appliedAt`. A migration is
 * "pending" if it has no row.
 *
 * Each migration file must export:
 *   - `name`      — a stable string, used as the idempotency key
 *   - `run()`     — an async function that performs the work
 *                   (it must be idempotent; the runner does not roll back)
 *
 * Migrations receive no arguments. If they need a DB connection, they
 * should call connectDb() themselves; the runner does not connect
 * globally, so a migration can choose its own connection semantics.
 *
 * This script is intentionally minimal. It does not version-pin the
 * migrations, does not roll back, and does not run inside a transaction.
 * Migrations are expected to be small, idempotent, and reviewed.
 *
 * Per docs/OPERATIONS.md §3, take an Atlas snapshot before running any
 * migration against production.
 */
import { readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIGRATIONS_DIR = join(process.cwd(), 'scripts', 'migrations');

type Migration = {
  name: string;
  run: () => Promise<void>;
};

type AppliedRow = { name: string; appliedAt: Date };

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => extname(f) === '.ts' && !f.endsWith('.test.ts') && !f.startsWith('_'))
    .map((f) => join(MIGRATIONS_DIR, f))
    .sort();
}

async function loadMigration(path: string): Promise<Migration> {
  const mod = (await import(pathToFileURL(path).href)) as {
    name?: string;
    run?: () => Promise<void>;
  };
  if (!mod.name || typeof mod.run !== 'function') {
    throw new Error(
      `Migration ${basename(path)} must export { name: string, run(): Promise<void> }`,
    );
  }
  return { name: mod.name, run: mod.run };
}

async function getAppliedNames(): Promise<Set<string>> {
  const { connectDb, disconnectDb } = await import('../src/lib/db/mongoose');
  const mongoose = (await import('mongoose')).default;
  await connectDb();
  const coll = mongoose.connection.collection('migrations');
  const rows = await coll.find({}).project<AppliedRow>({ name: 1, appliedAt: 1 }).toArray();
  await disconnectDb();
  return new Set(rows.map((r) => r.name));
}

async function recordApplied(name: string): Promise<void> {
  const { connectDb, disconnectDb } = await import('../src/lib/db/mongoose');
  const mongoose = (await import('mongoose')).default;
  await connectDb();
  const coll = mongoose.connection.collection('migrations');
  await coll.updateOne({ name }, { $set: { name, appliedAt: new Date() } }, { upsert: true });
  await disconnectDb();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const files = await listMigrationFiles();
  const migrations = await Promise.all(files.map(loadMigration));
  const applied = await getAppliedNames();

  const pending = migrations.filter((m) => !applied.has(m.name));

  if (args.length === 0) {
    // List mode.
    console.log('Migrations:');
    for (const m of migrations) {
      const state = applied.has(m.name) ? 'applied' : 'pending';
      console.log(`  [${state.padEnd(7)}] ${m.name}`);
    }
    console.log('');
    console.log(`Pending: ${pending.length}`);
    console.log('Run one:   npm run migrate -- <name>');
    console.log('Run all:   npm run migrate -- --all');
    return;
  }

  if (args.includes('--all')) {
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }
    for (const m of pending) {
      console.log(`Running: ${m.name}`);
      await m.run();
      await recordApplied(m.name);
      console.log(`Applied: ${m.name}`);
    }
    console.log(`Done. Applied ${pending.length} migration(s).`);
    return;
  }

  const target = args[0]!;
  const migration = migrations.find((m) => m.name === target);
  if (!migration) {
    console.error(`Unknown migration: ${target}`);
    console.error('Run "npm run migrate" to see the list.');
    process.exit(1);
  }
  if (applied.has(migration.name)) {
    console.log(`Already applied: ${migration.name}`);
    return;
  }
  console.log(`Running: ${migration.name}`);
  await migration.run();
  await recordApplied(migration.name);
  console.log(`Applied: ${migration.name}`);
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
