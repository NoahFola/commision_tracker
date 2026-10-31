/**
 * Explicitly builds all Mongoose indexes for the app's models.
 *
 * Run manually after schema changes and in CI:
 *   npm run db:sync-indexes
 *
 * Why not rely on Mongoose autoIndex in production?
 *   autoIndex can silently rebuild a large index on schema change,
 *   blocking writes. Explicit is safer for a system whose purpose is
 *   financial correctness.
 */
import { connectDb, disconnectDb } from '../src/lib/db/mongoose';
import { Admin, Region, Agent, AgentUser, PerformanceEvent } from '../src/models';

async function main(): Promise<void> {
  await connectDb();
  const models = [Admin, Region, Agent, AgentUser, PerformanceEvent] as const;
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (model as any).syncIndexes();
    console.log(`[sync-indexes] ${model.modelName} ✓`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error('[sync-indexes] failed:', err);
  process.exit(1);
});
