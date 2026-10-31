import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { connectDb } from '@/lib/db/mongoose';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  setupPhase4Fixtures,
  performanceBody,
  type Phase4Fixtures,
} from '@/services/__test__/performance-fixtures';

import { POST as postPerformance, GET as listPerformance } from '../route';
import { GET as aggregatePerformance } from '../aggregate/route';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('Phase 4 cross-cutting: status & scope', () => {
  let fx: Phase4Fixtures;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    fx = await setupPhase4Fixtures();
  });

  const postReq = (body: unknown, cookie?: string): Request =>
    new Request('http://x/api/performance', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const getReq = (url: string, cookie?: string): Request =>
    new Request(url, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  // -- 401 matrix --------------------------------------------------------

  it('POST /api/performance returns 401 without a session', async () => {
    const res = await postPerformance(postReq(performanceBody(fx.agentId, '2026-09-30')), ctx);
    expect(res.status).toBe(401);
  });

  it('GET /api/performance returns 401 without a session', async () => {
    const res = await listPerformance(getReq('http://x/api/performance'), ctx);
    expect(res.status).toBe(401);
  });

  it('GET /api/performance/aggregate returns 401 without a session', async () => {
    const res = await aggregatePerformance(getReq('http://x/api/performance/aggregate'), ctx);
    expect(res.status).toBe(401);
  });

  // -- 403 matrix: POST rejects AGENT ------------------------------------

  it('POST /api/performance returns 403 for an agent session', async () => {
    const res = await postPerformance(
      postReq(performanceBody(fx.agentId, '2026-09-30'), fx.agentSessionId),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it('POST /api/performance returns 403 for the other agent too', async () => {
    const res = await postPerformance(
      postReq(performanceBody(fx.otherAgentId, '2026-09-30'), fx.otherAgentSessionId),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  // -- 200 matrix: reads accept both roles -------------------------------

  it('GET /api/performance returns 200 for an admin', async () => {
    const res = await listPerformance(getReq('http://x/api/performance', fx.adminSessionId), ctx);
    expect(res.status).toBe(200);
  });

  it('GET /api/performance returns 200 for an agent', async () => {
    const res = await listPerformance(getReq('http://x/api/performance', fx.agentSessionId), ctx);
    expect(res.status).toBe(200);
  });

  it('GET /api/performance/aggregate returns 200 for an admin', async () => {
    const res = await aggregatePerformance(
      getReq('http://x/api/performance/aggregate', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it('GET /api/performance/aggregate returns 200 for an agent', async () => {
    const res = await aggregatePerformance(
      getReq('http://x/api/performance/aggregate', fx.agentSessionId),
      ctx,
    );
    expect(res.status).toBe(200);
  });

  // -- Object-level scope: no cross-agent leak ---------------------------

  it('no read endpoint leaks another agent’s data to an agent session', async () => {
    // Seed a row for agent A (our subject) and a row for agent B.
    const seedA = await postPerformance(
      postReq(performanceBody(fx.agentId, '2026-09-30', { leadsGenerated: 5 }), fx.adminSessionId),
      ctx,
    );
    expect(seedA.status).toBe(201);

    const seedB = await postPerformance(
      postReq(
        performanceBody(fx.otherAgentId, '2026-09-30', { leadsGenerated: 99 }),
        fx.adminSessionId,
      ),
      ctx,
    );
    expect(seedB.status).toBe(201);

    // Agent A lists without a filter: sees only their own row.
    const listRes = await listPerformance(
      getReq('http://x/api/performance?from=2026-09-01&to=2026-09-30', fx.agentSessionId),
      ctx,
    );
    const listJson = await listRes.json();
    expect(listJson.data.items).toHaveLength(1);
    expect(listJson.data.items[0].agentId).toBe(fx.agentId);
    expect(listJson.data.items[0].leadsGenerated).toBe(5);

    // Agent A tries to filter by agent B's id.
    // Scope wins: the query param is ignored. Agent A sees THEIR OWN
    // row (count 1, leadsGenerated: 5). If the query param had won,
    // we'd see agent B's row with leadsGenerated: 99. The critical
    // assertion is that the returned row belongs to agent A.
    const spoofRes = await listPerformance(
      getReq(
        `http://x/api/performance?agentId=${fx.otherAgentId}&from=2026-09-01&to=2026-09-30`,
        fx.agentSessionId,
      ),
      ctx,
    );
    const spoofJson = await spoofRes.json();
    expect(spoofJson.data.items).toHaveLength(1);
    expect(spoofJson.data.items[0].agentId).toBe(fx.agentId);
    expect(spoofJson.data.items[0].leadsGenerated).toBe(5);

    // Aggregate: agent A's rollup also excludes agent B's data.
    const aggRes = await aggregatePerformance(
      getReq(
        'http://x/api/performance/aggregate?from=2026-09-01&to=2026-09-30&granularity=monthly',
        fx.agentSessionId,
      ),
      ctx,
    );
    const aggJson = await aggRes.json();
    expect(aggJson.data.buckets).toHaveLength(1);
    expect(aggJson.data.buckets[0].leadsGenerated).toBe(5);
  });

  // -- Envelope consistency ---------------------------------------------

  it('every endpoint returns the standard envelope on success', async () => {
    const post = await postPerformance(
      postReq(performanceBody(fx.agentId, '2026-09-30'), fx.adminSessionId),
      ctx,
    );
    const list = await listPerformance(getReq('http://x/api/performance', fx.adminSessionId), ctx);
    const agg = await aggregatePerformance(
      getReq('http://x/api/performance/aggregate', fx.adminSessionId),
      ctx,
    );
    for (const res of [post, list, agg]) {
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).not.toHaveProperty('error');
    }
  });

  it('every endpoint returns the standard envelope on failure', async () => {
    const unauth = await listPerformance(getReq('http://x/api/performance'), ctx);
    const forbidden = await postPerformance(
      postReq(performanceBody(fx.agentId, '2026-09-30'), fx.agentSessionId),
      ctx,
    );
    const bad = await listPerformance(
      getReq('http://x/api/performance?from=bad', fx.adminSessionId),
      ctx,
    );
    for (const res of [unauth, forbidden, bad]) {
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    }
  });

  // -- Range cap across both endpoints ----------------------------------

  it('enforces the range cap on GET /api/performance', async () => {
    const res = await listPerformance(
      getReq('http://x/api/performance?from=2020-01-01&to=2026-01-01', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('enforces the range cap on GET /api/performance/aggregate', async () => {
    const res = await aggregatePerformance(
      getReq('http://x/api/performance/aggregate?from=2020-01-01&to=2026-01-01', fx.adminSessionId),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});
