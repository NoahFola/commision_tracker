import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import {
  Agent,
  ONBOARDING_STAGES,
  type AgentStatus,
  type OnboardingStage,
} from '@/models/agent.model';
import { AgentUser } from '@/models/agent-user.model';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { AuditLog } from '@/models/audit-log.model';
import { assertCanAccessAgent, scopeAgentFilter } from '@/lib/auth/guards';
import { hashPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/audit/write-audit';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/app-error';
import type { AuthMe, AuthMeAgent } from '@/types/auth';
import type { AgentListItem, AgentDetail } from '@/types/agent';
import type { Paginated } from '@/types/api';
import type {
  CreateAgentBody,
  ListAgentsQuery,
  UpdateAgentBody,
  UpdateMyProfileBody,
} from '@/lib/validation/agent';
import { getUnpaidBalance } from './commission.service';

/**
 * Guard: an agent must not be terminated while they still have unpaid
 * commissions.
 *
 * "Unpaid" means the SUM of netAmount over PENDING | VERIFIED | APPROVED
 * commissions is > 0. Not the COUNT of rows — a reversed-but-not-yet-
 * approved pair (original APPROVED + mirror PENDING) nets to zero and
 * does NOT block termination.
 *
 * Runs with the transaction's session so the check is consistent with
 * the status change it gates.
 *
 * Throws ConflictError (409) with the outstanding amount when blocked.
 */
export async function assertNoUnpaidCommissions(
  agentId: Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<void> {
  const balance = await getUnpaidBalance(agentId, session);
  if (balance.total > 0) {
    const currency = balance.currency ?? 'XAF';
    throw new ConflictError(
      `Cannot terminate: agent has ${balance.total} ${currency} in unpaid commissions`,
    );
  }
}

// ---------------------------------------------------------------------------
// State machines (pure)
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Record<AgentStatus, readonly AgentStatus[]> = {
  ACTIVE: ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'SUSPENDED', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'INACTIVE', 'TERMINATED'],
  TERMINATED: ['TERMINATED'],
};

/**
 * Throws BadRequestError if `from -> to` is not allowed.
 * `from == to` is always allowed (no-op).
 */
export function assertValidStatusTransition(from: AgentStatus, to: AgentStatus): void {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestError(`Cannot transition status from ${from} to ${to}`);
  }
}

/**
 * Forward-only progression through ONBOARDING_STAGES.
 * `from == to` is allowed (no-op). Skipping or going backward is rejected.
 */
export function assertValidOnboardingTransition(from: OnboardingStage, to: OnboardingStage): void {
  const fromIdx = ONBOARDING_STAGES.indexOf(from);
  const toIdx = ONBOARDING_STAGES.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) {
    throw new BadRequestError('Unknown onboarding stage');
  }
  if (toIdx < fromIdx) {
    throw new BadRequestError(`Cannot move onboarding stage backward from ${from} to ${to}`);
  }
  if (toIdx > fromIdx + 1) {
    throw new BadRequestError(`Cannot skip onboarding stage from ${from} to ${to}`);
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAgents(
  user: AuthMe,
  query: ListAgentsQuery,
): Promise<Paginated<AgentListItem>> {
  await connectDb();

  const base: Record<string, unknown> = {};
  if (query.status) base.status = query.status;
  if (query.type) base.type = query.type;
  if (query.regionId) base.regionId = new Types.ObjectId(query.regionId);

  const filter = scopeAgentFilter(user, base);
  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    Agent.find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate<{ regionId: { _id: Types.ObjectId; name: string } }>({
        path: 'regionId',
        select: '_id name',
      })
      .lean()
      .exec(),
    Agent.countDocuments(filter),
  ]);

    const items: AgentListItem[] = docs.map((d) => {
      const region = d.regionId as unknown as { _id: Types.ObjectId; name: string };
      return {
        id: String(d._id),
        fullName: d.fullName,
        type: d.type as AgentListItem['type'],
        email: d.email,
        phone: d.phone,
        status: d.status as AgentListItem['status'],
        onboardingStage: d.onboardingStage as AgentListItem['onboardingStage'],
        referralCode: d.referralCode,
        commissionRate: d.commissionRate as number, // ← add this line
        dateJoined: (d.dateJoined as Date).toISOString(),
        region: { id: String(region._id), name: region.name },
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

export async function getAgent(user: AuthMe, id: string): Promise<AgentDetail> {
  await connectDb();

  assertCanAccessAgent(user, id);

  const scoped = scopeAgentFilter(user, {});
  const doc = await Agent.findOne({ _id: new Types.ObjectId(id), ...scoped })
    .populate<{ regionId: { _id: Types.ObjectId; name: string } }>({
      path: 'regionId',
      select: '_id name',
    })
    .lean()
    .exec();

  if (!doc) throw new NotFoundError('Agent not found');

  const region = doc.regionId as unknown as { _id: Types.ObjectId; name: string };

  return {
    id: String(doc._id),
    fullName: doc.fullName as string,
    type: doc.type as AgentDetail['type'],
    email: doc.email as string,
    phone: doc.phone as string,
    status: doc.status as AgentDetail['status'],
    onboardingStage: doc.onboardingStage as AgentDetail['onboardingStage'],
    referralCode: doc.referralCode as string,
    dateJoined: (doc.dateJoined as Date).toISOString(),
    profilePictureUrl: (doc.profilePictureUrl ?? null) as string | null,
    payoutPreference: doc.payoutPreference as unknown as AgentDetail['payoutPreference'],
    region: { id: String(region._id), name: region.name },
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createAgent(user: AuthMe, body: CreateAgentBody): Promise<AgentDetail> {
  await connectDb();

  const region = await Region.findById(body.regionId).lean<{
    _id: Types.ObjectId;
    name: string;
    isActive: boolean;
  }>();
  if (!region) throw new BadRequestError('regionId does not reference an existing region');
  if (!region.isActive) throw new BadRequestError('regionId references an inactive region');

  const passwordHash = await hashPassword(body.password);
  const session = await mongoose.startSession();
  try {
    let created: AgentDetail | null = null;
    await session.withTransaction(async () => {
      const [agentDoc] = await Agent.create(
        [
          {
            fullName: body.fullName,
            type: body.type,
            email: body.email,
            phone: body.phone,
            regionId: new Types.ObjectId(body.regionId),
            referralCode: body.referralCode,
            status: body.status ?? 'ACTIVE',
            onboardingStage: body.onboardingStage ?? 'REGISTERED',
            payoutPreference: {
              method: body.payoutPreference.method,
              provider: body.payoutPreference.provider,
              accountNumber: body.payoutPreference.accountNumber,
              accountName: body.payoutPreference.accountName,
              isDefault: body.payoutPreference.isDefault ?? true,
            },
          },
        ],
        { session },
      );
      if (!agentDoc) throw new Error('Agent.create returned no document');

      await AgentUser.create([{ agentId: agentDoc._id, email: body.email, passwordHash }], {
        session,
      });

      await writeAudit({
        actorId: new Types.ObjectId(user.subjectId),
        actorEmail: user.email,
        actorType: 'ADMIN',
        entityType: 'Agent',
        entityId: String(agentDoc._id),
        action: 'CREATE',
        before: null,
        after: {
          _id: String(agentDoc._id),
          fullName: body.fullName,
          type: body.type,
          email: body.email,
          phone: body.phone,
          regionId: body.regionId,
          referralCode: body.referralCode,
          status: body.status ?? 'ACTIVE',
          onboardingStage: body.onboardingStage ?? 'REGISTERED',
          payoutPreference: body.payoutPreference,
        },
        session,
      });

      created = {
        id: String(agentDoc._id),
        fullName: agentDoc.fullName as string,
        type: agentDoc.type as AgentDetail['type'],
        email: agentDoc.email as string,
        phone: agentDoc.phone as string,
        status: agentDoc.status as AgentDetail['status'],
        onboardingStage: agentDoc.onboardingStage as AgentDetail['onboardingStage'],
        referralCode: agentDoc.referralCode as string,
        dateJoined: (agentDoc.dateJoined as Date).toISOString(),
        profilePictureUrl: (agentDoc.profilePictureUrl ?? null) as string | null,
        payoutPreference: agentDoc.payoutPreference as unknown as AgentDetail['payoutPreference'],
        region: { id: String(region._id), name: region.name },
      };
    });
    if (!created) throw new Error('Transaction completed without a created agent');
    return created;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const field = duplicateKeyField(err);
      throw new ConflictError(field ? `${field} is already in use` : 'Duplicate value', { field });
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * Fields whose change is audited (G1b).
 */
const AUDITED_FIELDS = ['status', 'onboardingStage', 'regionId', 'referralCode'] as const;
type AuditedField = (typeof AUDITED_FIELDS)[number];

/**
 * Updates an Agent. Transactional: the field update, the possible
 * AgentUser.email sync, and the audit row all commit or abort together.
 */
export async function updateAgent(
  user: AuthMe,
  id: string,
  body: UpdateAgentBody,
): Promise<AgentDetail> {
  await connectDb();

  assertCanAccessAgent(user, id);

  const agentObjectId = new Types.ObjectId(id);

  if (body.regionId !== undefined) {
    const region = await Region.findById(body.regionId).lean<{
      _id: Types.ObjectId;
      isActive: boolean;
    }>();
    if (!region) throw new BadRequestError('regionId does not reference an existing region');
    if (!region.isActive) throw new BadRequestError('regionId references an inactive region');
  }

  const session = await mongoose.startSession();
  try {
    let updated: AgentDetail | null = null;

    await session.withTransaction(async () => {
      const current = await Agent.findOne({ _id: agentObjectId }).session(session).exec();
      if (!current) throw new NotFoundError('Agent not found');

      const beforeAudit: Partial<Record<AuditedField, unknown>> = {};
      const afterAudit: Partial<Record<AuditedField, unknown>> = {};

      if (body.status !== undefined) {
        assertValidStatusTransition(current.status as AgentStatus, body.status);
        if (body.status === 'TERMINATED' && current.status !== 'TERMINATED') {
          await assertNoUnpaidCommissions(agentObjectId, session);
        }
        if (current.status !== body.status) {
          beforeAudit.status = current.status;
          afterAudit.status = body.status;
          current.status = body.status;
        }
      }

      if (body.onboardingStage !== undefined) {
        assertValidOnboardingTransition(
          current.onboardingStage as OnboardingStage,
          body.onboardingStage,
        );
        if (current.onboardingStage !== body.onboardingStage) {
          beforeAudit.onboardingStage = current.onboardingStage;
          afterAudit.onboardingStage = body.onboardingStage;
          current.onboardingStage = body.onboardingStage;
        }
      }

      if (body.fullName !== undefined) current.fullName = body.fullName;
      if (body.phone !== undefined) current.phone = body.phone;

      if (body.regionId !== undefined) {
        if (String(current.regionId) !== body.regionId) {
          beforeAudit.regionId = String(current.regionId);
          afterAudit.regionId = body.regionId;
          current.regionId = new Types.ObjectId(body.regionId);
        }
      }

      if (body.referralCode !== undefined) {
        if (current.referralCode !== body.referralCode) {
          beforeAudit.referralCode = current.referralCode;
          afterAudit.referralCode = body.referralCode;
          current.referralCode = body.referralCode;
        }
      }

      if (body.payoutPreference !== undefined) {
        const pp = body.payoutPreference;
        current.payoutPreference = {
          method: pp.method,
          provider: pp.provider,
          accountNumber: pp.accountNumber,
          accountName: pp.accountName,
          isDefault: pp.isDefault ?? current.payoutPreference.isDefault,
        };
      }

      let emailChanged = false;
      if (body.email !== undefined && current.email !== body.email) {
        current.email = body.email;
        emailChanged = true;
      }

      await current.save({ session });

      if (emailChanged) {
        await AgentUser.updateOne(
          { agentId: current._id },
          { $set: { email: body.email } },
          { session },
        );
      }

      const auditedChanges = Object.keys(afterAudit).length;
      if (auditedChanges > 0) {
        await writeAudit({
          actorId: new Types.ObjectId(user.subjectId),
          actorEmail: user.email,
          actorType: 'ADMIN',
          entityType: 'Agent',
          entityId: String(current._id),
          action: 'UPDATE',
          before: beforeAudit,
          after: afterAudit,
          session,
        });
      }

      const region = await Region.findById(current.regionId).lean<{
        _id: Types.ObjectId;
        name: string;
      }>();
      if (!region) throw new Error('Region not found for updated agent');

      updated = {
        id: String(current._id),
        fullName: current.fullName as string,
        type: current.type as AgentDetail['type'],
        email: current.email as string,
        phone: current.phone as string,
        status: current.status as AgentDetail['status'],
        onboardingStage: current.onboardingStage as AgentDetail['onboardingStage'],
        referralCode: current.referralCode as string,
        dateJoined: (current.dateJoined as Date).toISOString(),
        profilePictureUrl: (current.profilePictureUrl ?? null) as string | null,
        payoutPreference: current.payoutPreference as unknown as AgentDetail['payoutPreference'],
        region: { id: String(region._id), name: region.name },
      };
    });

    if (!updated) throw new Error('Transaction completed without an updated agent');
    return updated;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const field = duplicateKeyField(err);
      throw new ConflictError(field ? `${field} is already in use` : 'Duplicate value', { field });
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/** Narrow a MongoDB duplicate-key error (code 11000) without using `any`. */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

/** Extract the offending field name from a duplicate-key error, if present. */
function duplicateKeyField(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
  if (!keyPattern) return undefined;
  const keys = Object.keys(keyPattern);
  return keys[0];
}

/**
 * "Deletes" an agent by transitioning it to TERMINATED (G5a).
 * Delegates to updateAgent so the terminate guard and the audit row run
 * through exactly one path. Idempotent.
 */
export async function deleteAgent(user: AuthMe, id: string): Promise<AgentDetail> {
  return updateAgent(user, id, { status: 'TERMINATED' });
}

/**
 * The agent editing their own profile. Strictly narrower than
 * updateAgent: only `phone`, `payoutPreference`, and `profilePictureUrl`
 * are allowed.
 */
export async function updateOwnProfile(
  user: AuthMe,
  body: UpdateMyProfileBody,
): Promise<AuthMeAgent> {
  await connectDb();

  if (user.subjectType !== 'AGENT') {
    throw new ForbiddenError('Only an agent can edit their own profile');
  }

  const agentObjectId = new Types.ObjectId(user.agentId);

  const session = await mongoose.startSession();
  try {
    let updated: AuthMeAgent | null = null;

    await session.withTransaction(async () => {
      const current = await Agent.findById(agentObjectId).session(session).exec();
      if (!current) throw new NotFoundError('Agent not found');

      if (current.status !== 'ACTIVE') {
        throw new ForbiddenError('Your account is not active');
      }

      let payoutPreferenceChanged = false;
      const beforePreference = current.payoutPreference
        ? {
            method: current.payoutPreference.method,
            provider: current.payoutPreference.provider,
            accountNumber: current.payoutPreference.accountNumber,
            accountName: current.payoutPreference.accountName,
            isDefault: current.payoutPreference.isDefault,
          }
        : null;

      if (body.phone !== undefined) {
        current.phone = body.phone;
      }

      if (body.profilePictureUrl !== undefined) {
        current.profilePictureUrl = body.profilePictureUrl;
      }

      if (body.payoutPreference !== undefined) {
        const pp = body.payoutPreference;
        const next = {
          method: pp.method,
          provider: pp.provider,
          accountNumber: pp.accountNumber,
          accountName: pp.accountName,
          isDefault: pp.isDefault ?? current.payoutPreference?.isDefault ?? true,
        };
        const prev = beforePreference;
        if (
          !prev ||
          prev.method !== next.method ||
          prev.provider !== next.provider ||
          prev.accountNumber !== next.accountNumber ||
          prev.accountName !== next.accountName ||
          prev.isDefault !== next.isDefault
        ) {
          payoutPreferenceChanged = true;
        }
        current.payoutPreference = next;
      }

      await current.save({ session });

      if (payoutPreferenceChanged) {
        await writeAudit({
          actorId: agentObjectId,
          actorEmail: current.email,
          actorType: 'AGENT',
          entityType: 'Agent',
          entityId: String(current._id),
          action: 'UPDATE',
          before: { payoutPreference: beforePreference },
          after: {
            payoutPreference: {
              method: current.payoutPreference.method,
              provider: current.payoutPreference.provider,
              accountNumber: current.payoutPreference.accountNumber,
              accountName: current.payoutPreference.accountName,
              isDefault: current.payoutPreference.isDefault,
            },
          },
          session,
        });
      }

      updated = {
        subjectType: 'AGENT',
        subjectId: String(current._id),
        email: current.email as string,
        name: current.fullName as string,
        profilePictureUrl: (current.profilePictureUrl ?? null) as string | null,
        roles: [current.type as 'AGENT' | 'AMBASSADOR'],
        agentId: String(current._id),
        agentType: current.type as 'AGENT' | 'AMBASSADOR',
        referralCode: current.referralCode as string,
      };
    });

    if (!updated) throw new Error('Transaction completed without an updated profile');
    return updated;
  } finally {
    await session.endSession();
  }
}

export type OnboardingTransition = {
  stage: 'REGISTERED' | 'PROFILE_COMPLETE' | 'VERIFIED' | 'ONBOARDED';
  at: string;
  by: {
    id: string;
    name: string;
    type: 'ADMIN' | 'AGENT';
  };
};

export type OnboardingHistory = {
  agentId: string;
  currentStage: 'REGISTERED' | 'PROFILE_COMPLETE' | 'VERIFIED' | 'ONBOARDED';
  transitions: OnboardingTransition[];
};

/**
 * Returns the sequence of onboarding stage transitions for one agent,
 * in chronological order. The first entry is the agent creation event
 * (stage REGISTERED).
 *
 * Admin-only. Agents can see their current stage (on their own profile)
 * but not the history of who advanced each step.
 */
export async function getOnboardingHistory(
  user: AuthMe,
  agentId: string,
): Promise<OnboardingHistory> {
  await connectDb();

  if (user.subjectType !== 'ADMIN') {
    throw new ForbiddenError('Only an admin can view onboarding history');
  }

  if (!Types.ObjectId.isValid(agentId)) {
    throw new BadRequestError('id is not a valid identifier');
  }

  const agent = await Agent.findById(agentId).lean<{
    _id: Types.ObjectId;
    onboardingStage: OnboardingTransition['stage'];
  }>();
  if (!agent) throw new NotFoundError('Agent not found');

  const rows = await AuditLog.find({
    entityType: 'Agent',
    entityId: agentId,
    $or: [
      { action: 'CREATE' },
      {
        action: 'UPDATE',
        'diff.after.onboardingStage': { $exists: true },
      },
    ],
  })
    .sort({ at: 1 })
    .lean<
      {
        _id: Types.ObjectId;
        action: string;
        at: Date;
        actorId: Types.ObjectId;
        actorType?: 'ADMIN' | 'AGENT';
        diff: {
          before: { onboardingStage?: string } | null;
          after: { onboardingStage?: string } | null;
        };
      }[]
    >()
    .exec();

  const transitions: {
    stage: OnboardingTransition['stage'];
    at: Date;
    actorId: Types.ObjectId;
    actorType: 'ADMIN' | 'AGENT';
  }[] = [];

  let previousStage: string | null = null;
  for (const r of rows) {
    const stage = r.diff.after?.onboardingStage;
    if (!stage) continue;
    if (stage === previousStage) continue;
    transitions.push({
      stage: stage as OnboardingTransition['stage'],
      at: r.at,
      actorId: r.actorId,
      actorType: r.actorType ?? 'ADMIN',
    });
    previousStage = stage;
  }

  const adminIds = transitions.filter((t) => t.actorType === 'ADMIN').map((t) => t.actorId);
  const agentIds = transitions.filter((t) => t.actorType === 'AGENT').map((t) => t.actorId);

  const adminDocs =
    adminIds.length > 0
      ? await Admin.find({ _id: { $in: adminIds } })
          .select({ _id: 1, name: 1 })
          .lean<{ _id: Types.ObjectId; name: string }[]>()
      : [];
  const agentDocs =
    agentIds.length > 0
      ? await Agent.find({ _id: { $in: agentIds } })
          .select({ _id: 1, fullName: 1 })
          .lean<{ _id: Types.ObjectId; fullName: string }[]>()
      : [];

  const nameByAdminId = new Map(adminDocs.map((d) => [String(d._id), d.name]));
  const nameByAgentId = new Map(agentDocs.map((d) => [String(d._id), d.fullName]));

  return {
    agentId,
    currentStage: agent.onboardingStage,
    transitions: transitions.map((t) => {
      const idStr = String(t.actorId);
      const name =
        t.actorType === 'ADMIN'
          ? (nameByAdminId.get(idStr) ?? '(unknown admin)')
          : (nameByAgentId.get(idStr) ?? '(unknown agent)');
      return {
        stage: t.stage,
        at: t.at.toISOString(),
        by: { id: idStr, name, type: t.actorType },
      };
    }),
  };
}
