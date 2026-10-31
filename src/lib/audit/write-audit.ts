import { Types, type ClientSession } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { AuditLog, type AuditAction, type AuditActorType } from '@/models/audit-log.model';

export type WriteAuditInput = {
  actorId: Types.ObjectId;
  actorEmail: string;
  actorType: AuditActorType;
  entityType: string;
  entityId: string | Types.ObjectId;
  action: AuditAction;
  before: unknown;
  after: unknown;
  reason?: string;
  session?: ClientSession;
};

/**
 * The single chokepoint for writing audit rows.
 *
 * Rules:
 *   - Callers MUST provide actorId, actorEmail, and actorType. There is
 *     no "system" actor.
 *   - Callers SHOULD pass `before` and `after` as full snapshots.
 *   - THROWS on failure. Never swallows an error. A missing audit row
 *     is a correctness bug.
 *   - If the caller is inside a transaction, it MUST pass `session`.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await connectDb();

  if (!input.actorId) {
    throw new Error('writeAudit: actorId is required');
  }
  if (!input.actorEmail) {
    throw new Error('writeAudit: actorEmail is required');
  }
  if (input.actorType !== 'ADMIN' && input.actorType !== 'AGENT') {
    throw new Error('writeAudit: actorType must be ADMIN or AGENT');
  }

  const doc = {
    actorId: input.actorId,
    actorEmail: input.actorEmail.trim().toLowerCase(),
    actorType: input.actorType,
    entityType: input.entityType,
    entityId: String(input.entityId),
    action: input.action,
    diff: {
      before: input.before ?? null,
      after: input.after ?? null,
    },
    reason: input.reason,
    at: new Date(),
  };

  if (input.session) {
    await AuditLog.create([doc], { session: input.session });
  } else {
    await AuditLog.create(doc);
  }
}
