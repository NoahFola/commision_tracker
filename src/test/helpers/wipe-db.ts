import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { AuditLog } from '@/models/audit-log.model';
import { PerformanceEvent } from '@/models/performance-event.model';
import { Commission } from '@/models/commission.model'; // ← MUST be here
import { PayoutBatch } from '@/models/payout-batch.model'; // ← MUST be here
import { AgentUser } from '@/models/agent-user.model'; // ← MUST be here (see Fix 3)

export async function wipeAllCollections(): Promise<void> {
  await Promise.all([
    PayoutBatch.deleteMany({}),
    Commission.deleteMany({}),
    AgentUser.deleteMany({}),
    Agent.deleteMany({}),
    Region.deleteMany({}),
    Admin.deleteMany({}),
    Session.deleteMany({}),
    AuditLog.deleteMany({}),
    PerformanceEvent.deleteMany({}),
  ]);
}
