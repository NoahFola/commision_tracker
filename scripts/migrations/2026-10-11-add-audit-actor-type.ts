/**
 * Migration: backfill actorType on all existing audit rows.
 *
 * For each audit row with no actorType:
 *   - Look up the actor's email in Admin.
 *   - Found  -> actorType = 'ADMIN'.
 *   - Missing -> actorType = 'AGENT'.
 *
 * Idempotent. Safe to run twice.
 *
 * Run with:
 *   npm run migrate -- 2026-10-11-add-audit-actor-type
 *
 * Take an Atlas snapshot first (docs/OPERATIONS.md §3).
 */
import { connectDb, disconnectDb } from '../../src/lib/db/mongoose';
import { AuditLog } from '../../src/models/audit-log.model';
import { Admin } from '../../src/models/admin.model';

export const name = '2026-10-11-add-audit-actor-type';

export async function run(): Promise<void> {
  await connectDb();

  const total = await AuditLog.countDocuments({ actorType: { $exists: false } });
  console.log(`[${name}] rows missing actorType: ${total}`);
  if (total === 0) {
    await disconnectDb();
    return;
  }

  const admins = await Admin.find({}).select({ email: 1 }).lean<{ email: string }[]>();
  const adminEmails = new Set(admins.map((a) => a.email.toLowerCase()));

  let processed = 0;
  let adminCount = 0;
  let agentCount = 0;

  const cursor = AuditLog.find({ actorType: { $exists: false } })
    .select({ _id: 1, actorEmail: 1 })
    .lean<{ _id: unknown; actorEmail: string }[]>()
    .cursor();

  for await (const row of cursor) {
    const email = (row.actorEmail ?? '').toLowerCase();
    const actorType = adminEmails.has(email) ? 'ADMIN' : 'AGENT';
    await AuditLog.updateOne({ _id: row._id }, { $set: { actorType } });
    processed += 1;
    if (actorType === 'ADMIN') adminCount += 1;
    else agentCount += 1;
    if (processed % 100 === 0) {
      console.log(`[${name}] processed ${processed}`);
    }
  }

  console.log(`[${name}] done. processed=${processed} admin=${adminCount} agent=${agentCount}`);
  await disconnectDb();
}
