import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../src/lib/db/mongoose';
import { Region } from '../src/models/region.model';
import { Agent } from '../src/models/agent.model';
import { AgentUser } from '../src/models/agent-user.model';
import { Commission } from '../src/models/commission.model';
import { PayoutBatch } from '../src/models/payout-batch.model';
import { PerformanceEvent } from '../src/models/performance-event.model';

const SEED_FILE = join(process.cwd(), 'scripts', '.seeded-ids.json');

type SeedManifest = {
  regions: string[];
  agents: string[];
  agentUsers: string[];
  commissions: string[];
  payoutBatches: string[];
  performanceEvents: string[];
  seededAt: string;
};

async function clearSeed() {
  if (!existsSync(SEED_FILE)) {
    console.error(`No seed manifest found at ${SEED_FILE}. Nothing to clear.`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedManifest;
  console.log(`Clearing data seeded on ${manifest.seededAt}`);
  console.log('  Commissions:      ', manifest.commissions.length);
  console.log('  Payout batches:   ', manifest.payoutBatches.length);
  console.log('  Performance rows: ', manifest.performanceEvents.length);
  console.log('  Agents:           ', manifest.agents.length);
  console.log('  Agent users:      ', manifest.agentUsers.length);
  console.log('  Regions:          ', manifest.regions.length);

  await connectDb();

  // Order matters: delete children before parents to avoid orphaned refs.
  const toObjectIds = (ids: string[]) => ids.map((id) => new Types.ObjectId(id));

  if (manifest.performanceEvents.length) {
    await PerformanceEvent.deleteMany({ _id: { $in: toObjectIds(manifest.performanceEvents) } });
  }
  if (manifest.payoutBatches.length) {
    // Unlink commissions from these batches first (in case the cascade in the
    // seed left refs); deleteMany on commissions will remove the seed rows
    // anyway, but being defensive keeps a partial clear safe.
    await Commission.updateMany(
      { payoutBatchId: { $in: toObjectIds(manifest.payoutBatches) } },
      { $set: { payoutBatchId: null } },
    );
    await PayoutBatch.deleteMany({ _id: { $in: toObjectIds(manifest.payoutBatches) } });
  }
  if (manifest.commissions.length) {
    await Commission.deleteMany({ _id: { $in: toObjectIds(manifest.commissions) } });
  }
  if (manifest.agentUsers.length) {
    await AgentUser.deleteMany({ _id: { $in: toObjectIds(manifest.agentUsers) } });
  }
  if (manifest.agents.length) {
    await Agent.deleteMany({ _id: { $in: toObjectIds(manifest.agents) } });
  }
  if (manifest.regions.length) {
    await Region.deleteMany({ _id: { $in: toObjectIds(manifest.regions) } });
  }

  console.log('\nSeed cleared.');
  await disconnectDb();
  process.exit(0);
}

clearSeed().catch((err) => {
  console.error('Clear failed:', err);
  process.exit(1);
});
