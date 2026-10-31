import { connectDb } from '@/lib/db/mongoose';
import { AuditLog } from '@/models/audit-log.model';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { writeAudit } from '../write-audit';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('writeAudit', () => {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(async () => {
  // Intentionally do NOT disconnect — the connection is shared across
  // test files in the worker. See vitest.setup.ts.
});
  beforeEach(async () => {
    await AuditLog.deleteMany({});
  });

  it('writes a row with the expected shape', async () => {
    const actorId = new Types.ObjectId();
    await writeAudit({
      actorId,
      actorEmail: 'Admin@EpsiHome.cm',
      actorType: 'ADMIN',
      entityType: 'Agent',
      entityId: 'agent-123',
      action: 'CREATE',
      before: null,
      after: { fullName: 'Awa' },
    });

    const rows = await AuditLog.find({});
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.actorEmail).toBe('admin@epsihome.cm');
    expect(row.action).toBe('CREATE');
    expect(row.diff.before).toBeNull();
    expect(row.diff.after).toEqual({ fullName: 'Awa' });
    expect(row.at).toBeInstanceOf(Date);
  });

  it('rejects a missing actorId', async () => {
    await expect(
      writeAudit({
        actorId: undefined as unknown as Types.ObjectId,
        actorEmail: 'x@y.z',
        actorType: 'ADMIN',
        entityType: 'Agent',
        entityId: 'x',
        action: 'CREATE',
        before: null,
        after: null,
      }),
    ).rejects.toThrow(/actorId/);
  });

  it('rejects a missing actorEmail', async () => {
    await expect(
      writeAudit({
        actorId: new Types.ObjectId(),
        actorType: 'ADMIN',
        actorEmail: '',
        entityType: 'Agent',
        entityId: 'x',
        action: 'CREATE',
        before: null,
        after: null,
      }),
    ).rejects.toThrow(/actorEmail/);
  });

  it('rejects an invalid action via schema enum', async () => {
    await expect(
      writeAudit({
        actorId: new Types.ObjectId(),
        actorEmail: 'x@y.z',
        actorType: 'ADMIN',
        entityType: 'Agent',
        entityId: 'x',
        action: 'DESTROY' as never,
        before: null,
        after: null,
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid actorType', async () => {
    await expect(
      writeAudit({
        actorId: new Types.ObjectId(),
        actorEmail: 'x@y.z',
        actorType: 'SYSTEM' as never,
        entityType: 'Agent',
        entityId: 'x',
        action: 'CREATE',
        before: null,
        after: null,
      }),
    ).rejects.toThrow(/actorType/);
  });

  it('persists actorType on the row', async () => {
    const actorId = new Types.ObjectId();
    await writeAudit({
      actorId,
      actorEmail: 'Admin@EpsiHome.cm',
      actorType: 'ADMIN',
      entityType: 'Agent',
      entityId: 'agent-1',
      action: 'CREATE',
      before: null,
      after: { x: 1 },
    });
    const row = await AuditLog.findOne({ entityId: 'agent-1' }).lean<{
      actorType: string;
    }>();
    expect(row?.actorType).toBe('ADMIN');
  });
});
