import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { connectDb } from '@/lib/db/mongoose';
import { Region } from '@/models/region.model';
import { Admin } from '@/models/admin.model';
import { Session } from '@/models/session.model';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

import { GET as listRegionsRoute, POST as createRegionRoute } from '../route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('regions routes', () => {
  let adminSessionId: string;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    // await Promise.all([Region.deleteMany({}), Admin.deleteMany({}), Session.deleteMany({})]);
    await wipeAllCollections()
    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    adminSessionId = (await createSession({ type: 'ADMIN', id: admin._id })).sessionId;
  });

  const postReq = (body: unknown, cookie?: string): Request =>
    new Request('http://x/api/regions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const getReq = (qs = '', cookie?: string): Request =>
    new Request(`http://x/api/regions${qs}`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
    });

  const ctx = { params: Promise.resolve({}) };

  // POST ---------------------------------------------------------------

  it('POST returns 401 when unauthenticated', async () => {
    const res = await createRegionRoute(postReq({ name: 'Douala' }), ctx);
    expect(res.status).toBe(401);
  });

  it('POST creates a region and returns 201 with the view', async () => {
    const res = await createRegionRoute(
      postReq({ name: 'Douala', code: 'DLA' }, adminSessionId),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Douala');
    expect(body.data.code).toBe('DLA');
    expect(body.data.isActive).toBe(true);
    expect(body.data).not.toHaveProperty('nameKey');
  });

  it('POST returns 400 for a missing name', async () => {
    const res = await createRegionRoute(postReq({}, adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('POST returns 409 on a case-insensitive duplicate name', async () => {
    await createRegionRoute(postReq({ name: 'Douala' }, adminSessionId), ctx);
    const res = await createRegionRoute(postReq({ name: 'douala' }, adminSessionId), ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  // GET ----------------------------------------------------------------

  it('GET returns 401 when unauthenticated', async () => {
    const res = await listRegionsRoute(getReq(), ctx);
    expect(res.status).toBe(401);
  });

  it('GET returns all regions sorted by name', async () => {
    await createRegionRoute(postReq({ name: 'Yaoundé' }, adminSessionId), ctx);
    await createRegionRoute(postReq({ name: 'Douala' }, adminSessionId), ctx);
    await createRegionRoute(postReq({ name: 'Bafoussam' }, adminSessionId), ctx);

    const res = await listRegionsRoute(getReq('', adminSessionId), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items.map((r: { name: string }) => r.name)).toEqual([
      'Bafoussam',
      'Douala',
      'Yaoundé',
    ]);
  });

  it('GET filters by isActive', async () => {
    await createRegionRoute(postReq({ name: 'ActiveCo' }, adminSessionId), ctx);
    await createRegionRoute(postReq({ name: 'OldCo', isActive: false }, adminSessionId), ctx);

    const onlyActive = await listRegionsRoute(getReq('?isActive=true', adminSessionId), ctx);
    const onlyActiveBody = await onlyActive.json();
    expect(onlyActiveBody.data.items).toHaveLength(1);
    expect(onlyActiveBody.data.items[0].name).toBe('ActiveCo');

    const onlyInactive = await listRegionsRoute(getReq('?isActive=false', adminSessionId), ctx);
    const onlyInactiveBody = await onlyInactive.json();
    expect(onlyInactiveBody.data.items).toHaveLength(1);
    expect(onlyInactiveBody.data.items[0].name).toBe('OldCo');
  });

  it('GET rejects a malformed isActive filter with 400', async () => {
    const res = await listRegionsRoute(getReq('?isActive=maybe', adminSessionId), ctx);
    expect(res.status).toBe(400);
  });

  it('GET returns no nameKey field on any item', async () => {
    await createRegionRoute(postReq({ name: 'Douala' }, adminSessionId), ctx);
    const res = await listRegionsRoute(getReq('', adminSessionId), ctx);
    const body = await res.json();
    for (const item of body.data.items) {
      expect(item).not.toHaveProperty('nameKey');
    }
  });
});
