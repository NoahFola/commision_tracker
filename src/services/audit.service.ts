import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { AuditLog, type AuditAction, type AuditActorType } from '@/models/audit-log.model';
import { Admin } from '@/models/admin.model';
import { Agent } from '@/models/agent.model';
import { BadRequestError } from '@/lib/errors/app-error';
import type { AuthMe } from '@/types/auth';
import type { Paginated } from '@/types/api';

export type AuditRowView = {
  id: string;
  at: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actor: {
    id: string;
    email: string;
    name: string;
    type: AuditActorType;
  };
  before: unknown;
  after: unknown;
  reason: string | null;
};

/**
 * Lists audit rows for one entity. Admin-only.
 *
 * Rows are sorted newest first. The actor's name is resolved in a
 * batched query (one query to Admin, one to Agent) so a page of
 * results is always two DB round trips regardless of row count.
 */
export async function listAuditRows(
  user: AuthMe,
  query: { entityType: string; entityId: string; page: number; limit: number },
): Promise<Paginated<AuditRowView>> {
  await connectDb();

  if (user.subjectType !== 'ADMIN') {
    throw new BadRequestError('Only admins can list audit rows');
  }

  const filter = {
    entityType: query.entityType,
    entityId: query.entityId,
  };

  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean<
        {
          _id: Types.ObjectId;
          at: Date;
          action: AuditAction;
          entityType: string;
          entityId: string;
          actorId: Types.ObjectId;
          actorEmail: string;
          actorType?: AuditActorType;
          diff: { before: unknown; after: unknown };
          reason?: string | null;
        }[]
      >()
      .exec(),
    AuditLog.countDocuments(filter),
  ]);

  // Resolve actor names in two batched queries.
  const adminIds = docs.filter((d) => (d.actorType ?? 'ADMIN') === 'ADMIN').map((d) => d.actorId);
  const agentIds = docs.filter((d) => d.actorType === 'AGENT').map((d) => d.actorId);

  const [adminDocs, agentDocs] = await Promise.all([
    adminIds.length > 0
      ? Admin.find({ _id: { $in: adminIds } })
          .select({ _id: 1, name: 1 })
          .lean<{ _id: Types.ObjectId; name: string }[]>()
      : Promise.resolve([]),
    agentIds.length > 0
      ? Agent.find({ _id: { $in: agentIds } })
          .select({ _id: 1, fullName: 1 })
          .lean<{ _id: Types.ObjectId; fullName: string }[]>()
      : Promise.resolve([]),
  ]);

  const nameByAdmin = new Map(adminDocs.map((d) => [String(d._id), d.name]));
  const nameByAgent = new Map(agentDocs.map((d) => [String(d._id), d.fullName]));

  const items: AuditRowView[] = docs.map((d) => {
    const actorType: AuditActorType = d.actorType ?? 'ADMIN';
    const name =
      actorType === 'ADMIN'
        ? (nameByAdmin.get(String(d.actorId)) ?? '(unknown admin)')
        : (nameByAgent.get(String(d.actorId)) ?? '(unknown agent)');
    return {
      id: String(d._id),
      at: d.at.toISOString(),
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId,
      actor: {
        id: String(d.actorId),
        email: d.actorEmail,
        name,
        type: actorType,
      },
      before: d.diff.before,
      after: d.diff.after,
      reason: d.reason ?? null,
    };
  });

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}
