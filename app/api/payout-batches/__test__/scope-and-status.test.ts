import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  setupCommissionFixtures,
  type CommissionFixtures,
} from '@/services/__test__/commission-fixtures';
import {
  createCommission,
  verifyCommission,
  approveCommission,
  getUnpaidBalance,
} from '@/services/commission.service';

import { POST as createBatch, GET as listBatches } from '../route';
import { GET as getBatch } from '../[id]/route';
import { POST as addCommission } from '../[id]/commissions/route';
import { DELETE as removeCommission } from '../[id]/commissions/[commissionId]/route';
import { POST as approveBatch } from '../[id]/approve/route';
import { POST as markProcessing } from '../[id]/processing/route';
import { POST as markPaid } from '../[id]/paid/route';
import { POST as markFailed } from '../[id]/fail/route';
import { makeAdminUser } from '@/lib/auth/__test__/fixtures';

const hasTestDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasTestDb)('Phase 6 cross-cutting: status & scope', () => {
  let fx: CommissionFixtures;
  let customerSeq = 0;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    fx = await setupCommissionFixtures();
    customerSeq = 0;
  });

  // -- HTTP helpers --------------------------------------------------------

  const req = (url: string, method: string, cookie?: string, body?: unknown): Request =>
    new Request(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  const ctx = { params: Promise.resolve({}) };
  const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });
  const ctxCommission = (id: string, commissionId: string) => ({
    params: Promise.resolve({ id, commissionId }),
  });

  // -- Seed helpers --------------------------------------------------------

  /**
   * Seeds `count` APPROVED commissions (net 950 each) for fx.agentId in
   * period 2026-09, then creates a DRAFT batch from them. Returns the
   * batch id and the commission ids.
   */
  async function seedDraftBatch(count = 6): Promise<{
    batchId: string;
    commissionIds: string[];
  }> {
    // const adminUser = {
    //   subjectType: 'ADMIN' as const,
    //   subjectId: fx.adminId,
    //   email: 'admin@epsihome.cm',
    //   name: 'Ops',
    //   profilePictureUrl: null,
    //   roles: ['ADMIN'],
    // };

    const adminUser = makeAdminUser();

    const commissionIds: string[] = [];
    for (let i = 0; i < count; i++) {
      customerSeq += 1;
      const c = await createCommission(adminUser, {
        agentId: fx.agentId,
        coreCustomerId: `CUST-${customerSeq}`,
        firstPaymentConfirmedAt: '2026-09-15T10:00:00.000Z',
        baseAmount: { amount: 20000, currency: 'XAF' },
      });
      await verifyCommission(adminUser, c.id);
      await approveCommission(adminUser, c.id);
      commissionIds.push(c.id);
    }

    const res = await createBatch(
      req('http://x/api/payout-batches', 'POST', fx.adminSessionId, {
        agentId: fx.agentId,
        period: '2026-09',
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    return { batchId: body.data.id, commissionIds };
  }

  // -- 401 matrix ----------------------------------------------------------

  it('all endpoints return 401 without a session', async () => {
    const id = new Types.ObjectId().toHexString();
    const cid = new Types.ObjectId().toHexString();
    const cases: Promise<Response>[] = [
      createBatch(
        req('http://x/api/payout-batches', 'POST', undefined, {
          agentId: fx.agentId,
          period: '2026-09',
        }),
        ctx,
      ),
      listBatches(req('http://x/api/payout-batches', 'GET'), ctx),
      getBatch(req(`http://x/api/payout-batches/${id}`, 'GET'), ctxId(id)),
      addCommission(
        req(`http://x/api/payout-batches/${id}/commissions`, 'POST', undefined, {
          commissionId: cid,
        }),
        ctxId(id),
      ),
      removeCommission(
        req(`http://x/api/payout-batches/${id}/commissions/${cid}`, 'DELETE'),
        ctxCommission(id, cid),
      ),
      approveBatch(req(`http://x/api/payout-batches/${id}/approve`, 'POST'), ctxId(id)),
      markProcessing(req(`http://x/api/payout-batches/${id}/processing`, 'POST'), ctxId(id)),
      markPaid(
        req(`http://x/api/payout-batches/${id}/paid`, 'POST', undefined, {
          paymentReference: 'TEST',
        }),
        ctxId(id),
      ),
      markFailed(
        req(`http://x/api/payout-batches/${id}/fail`, 'POST', undefined, {
          reason: 'test',
        }),
        ctxId(id),
      ),
    ];
    for (const p of cases) {
      expect((await p).status).toBe(401);
    }
  });

  // -- 403 matrix: admin-only writes reject agent sessions -----------------

  it('all admin-only write endpoints return 403 for an agent session', async () => {
    const { batchId, commissionIds } = await seedDraftBatch();
    const extraCommission = commissionIds[0]!;
    const cases: Promise<Response>[] = [
      createBatch(
        req('http://x/api/payout-batches', 'POST', fx.agentSessionId, {
          agentId: fx.agentId,
          period: '2026-09',
        }),
        ctx,
      ),
      addCommission(
        req(`http://x/api/payout-batches/${batchId}/commissions`, 'POST', fx.agentSessionId, {
          commissionId: extraCommission,
        }),
        ctxId(batchId),
      ),
      removeCommission(
        req(
          `http://x/api/payout-batches/${batchId}/commissions/${extraCommission}`,
          'DELETE',
          fx.agentSessionId,
        ),
        ctxCommission(batchId, extraCommission),
      ),
      approveBatch(
        req(`http://x/api/payout-batches/${batchId}/approve`, 'POST', fx.agentSessionId),
        ctxId(batchId),
      ),
      markProcessing(
        req(`http://x/api/payout-batches/${batchId}/processing`, 'POST', fx.agentSessionId),
        ctxId(batchId),
      ),
      markPaid(
        req(`http://x/api/payout-batches/${batchId}/paid`, 'POST', fx.agentSessionId, {
          paymentReference: 'X',
        }),
        ctxId(batchId),
      ),
      markFailed(
        req(`http://x/api/payout-batches/${batchId}/fail`, 'POST', fx.agentSessionId, {
          reason: 'X',
        }),
        ctxId(batchId),
      ),
    ];
    for (const p of cases) {
      expect((await p).status).toBe(403);
    }
  });

  // -- 200 matrix: reads accept both roles ---------------------------------

  it('read endpoints return 200 for admin and for the owning agent', async () => {
    const { batchId } = await seedDraftBatch();

    const listAdmin = await listBatches(
      req('http://x/api/payout-batches', 'GET', fx.adminSessionId),
      ctx,
    );
    const listAgent = await listBatches(
      req('http://x/api/payout-batches', 'GET', fx.agentSessionId),
      ctx,
    );
    const detailAdmin = await getBatch(
      req(`http://x/api/payout-batches/${batchId}`, 'GET', fx.adminSessionId),
      ctxId(batchId),
    );
    const detailAgent = await getBatch(
      req(`http://x/api/payout-batches/${batchId}`, 'GET', fx.agentSessionId),
      ctxId(batchId),
    );

    expect(listAdmin.status).toBe(200);
    expect(listAgent.status).toBe(200);
    expect(detailAdmin.status).toBe(200);
    expect(detailAgent.status).toBe(200);
  });

  // -- Object-level scope --------------------------------------------------

  it('an agent cannot read another agent’s batch (403)', async () => {
    const { batchId } = await seedDraftBatch();
    const res = await getBatch(
      req(`http://x/api/payout-batches/${batchId}`, 'GET', fx.otherAgentSessionId),
      ctxId(batchId),
    );
    expect(res.status).toBe(403);
  });

  it('an agent’s batch list never shows another agent’s batches', async () => {
    await seedDraftBatch();
    const res = await listBatches(
      req('http://x/api/payout-batches', 'GET', fx.agentSessionId),
      ctx,
    );
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(fx.agentId);

    // The other agent sees nothing.
    const other = await listBatches(
      req('http://x/api/payout-batches', 'GET', fx.otherAgentSessionId),
      ctx,
    );
    const otherBody = await other.json();
    expect(otherBody.data.items).toHaveLength(0);
  });

  it('an agent asking for another agentId via query is silently narrowed', async () => {
    await seedDraftBatch();
    const res = await listBatches(
      req(`http://x/api/payout-batches?agentId=${fx.otherAgentId}`, 'GET', fx.agentSessionId),
      ctx,
    );
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].agentId).toBe(fx.agentId);
  });

  // -- Envelope consistency ------------------------------------------------

  it('every endpoint returns the standard envelope on success', async () => {
    const { batchId } = await seedDraftBatch();

    const list = await listBatches(
      req('http://x/api/payout-batches', 'GET', fx.adminSessionId),
      ctx,
    );
    const detail = await getBatch(
      req(`http://x/api/payout-batches/${batchId}`, 'GET', fx.adminSessionId),
      ctxId(batchId),
    );
    const approved = await approveBatch(
      req(`http://x/api/payout-batches/${batchId}/approve`, 'POST', fx.adminSessionId),
      ctxId(batchId),
    );

    for (const r of [list, detail, approved]) {
      const body = await r.json();
      expect(body.ok).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).not.toHaveProperty('error');
    }
  });

  it('every endpoint returns the standard envelope on failure', async () => {
    const unauth = await listBatches(req('http://x/api/payout-batches', 'GET'), ctx);
    const badBody = await listBatches(
      req('http://x/api/payout-batches?limit=7', 'GET', fx.adminSessionId),
      ctx,
    );
    const notFoundId = new Types.ObjectId().toHexString();
    const notFound = await getBatch(
      req(`http://x/api/payout-batches/${notFoundId}`, 'GET', fx.adminSessionId),
      ctxId(notFoundId),
    );
    for (const r of [unauth, badBody, notFound]) {
      const body = await r.json();
      expect(body.ok).toBe(false);
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    }
  });

  // -- The batch -> commission PAID invariant, at the HTTP layer ----------

  it('marking a batch PAID flips every commission to PAID', async () => {
    const { batchId, commissionIds } = await seedDraftBatch();

    await approveBatch(
      req(`http://x/api/payout-batches/${batchId}/approve`, 'POST', fx.adminSessionId),
      ctxId(batchId),
    );
    await markProcessing(
      req(`http://x/api/payout-batches/${batchId}/processing`, 'POST', fx.adminSessionId),
      ctxId(batchId),
    );
    const paid = await markPaid(
      req(`http://x/api/payout-batches/${batchId}/paid`, 'POST', fx.adminSessionId, {
        paymentReference: 'MOMO-CROSS-1',
      }),
      ctxId(batchId),
    );
    expect(paid.status).toBe(200);
    const paidBody = await paid.json();
    expect(paidBody.data.status).toBe('PAID');

    // The unpaid balance for this agent is now zero.
    const balance = await getUnpaidBalance(fx.agentId);
    expect(balance.total).toBe(0);
    expect(balance.count).toBe(0);

    // Sanity: the batch's commissionIds equals what we seeded.
    expect([...commissionIds].sort()).toEqual([...paidBody.data.commissionIds].sort());
  });

  it('a failed batch releases commissions; the terminate guard agrees', async () => {
    const { batchId } = await seedDraftBatch();

    await approveBatch(
      req(`http://x/api/payout-batches/${batchId}/approve`, 'POST', fx.adminSessionId),
      ctxId(batchId),
    );
    const failed = await markFailed(
      req(`http://x/api/payout-batches/${batchId}/fail`, 'POST', fx.adminSessionId, {
        reason: 'Operator rejected MoMo transfer',
      }),
      ctxId(batchId),
    );
    expect(failed.status).toBe(200);

    // Commissions are released and unpaid again.
    const balance = await getUnpaidBalance(fx.agentId);
    expect(balance.total).toBe(6 * 950);
    expect(balance.count).toBe(6);
  });
});
