/**
 * Vitest global setup — runs ONCE per test run, in the main process,
 * before any worker starts. Starts an in-memory MongoDB replica set and
 * exposes its URI via process.env.MONGODB_URI so that every worker
 * picks it up.
 *
 * The binary download happens on first install; subsequent starts are
 * ~1 second on a warm system. The longer launch timeout is for cold
 * Windows boots where the whole test suite is competing for disk I/O.
 */

import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet | null = null;

export async function setup(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 30000 }],
  });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  console.log('[vitest-global-setup] in-memory MongoDB started');
}

export async function teardown(): Promise<void> {
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}
