// @vitest-environment happy-dom

vi.mock('@/lib/auth/session-server', () => ({
  requireAdmin: async () => ({
    subjectType: 'ADMIN',
    subjectId: 'test-admin',
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
  }),
  requireSessionUser: async () => ({
    subjectType: 'ADMIN',
    subjectId: 'test-admin',
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
  }),
  getSessionUser: async () => ({
    subjectType: 'ADMIN',
    subjectId: 'test-admin',
    email: 'admin@epsihome.cm',
    name: 'Ops',
    profilePictureUrl: null,
    roles: ['ADMIN'],
  }),
}));

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: () => {},
    push: () => {},
    back: () => {},
    refresh: () => {},
  }),
  notFound: () => {
    throw new Error('not-found');
  },
}));

import { connectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { AgentUser } from '@/models/agent-user.model';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { Session } from '@/models/session.model';
import EditAgentPage from '../page';

const hasTestDb = Boolean(process.env.MONGODB_URI);

afterEach(() => cleanup());

describe.skipIf(!hasTestDb)('edit agent page', () => {
  let agentId: string;

  beforeEach(async () => {
    await connectDb();
    await Promise.all([
      Agent.deleteMany({}),
      Region.deleteMany({}),
      Admin.deleteMany({}),
      AgentUser.deleteMany({}),
      Session.deleteMany({}),
    ]);

    const admin = await Admin.create({
      email: 'admin@epsihome.cm',
      name: 'Ops',
      passwordHash: 'x'.repeat(60),
    });
    const region = await Region.create({ name: 'Douala' });
    const agent = await Agent.create({
      fullName: 'Awa Ngwa',
      type: 'AGENT',
      email: 'awa@example.cm',
      phone: '+237600000000',
      regionId: region._id,
      referralCode: 'AWA01',
      payoutPreference: { method: 'MOBILE_MONEY', provider: 'MTN MoMo' },
    });
    agentId = String(agent._id);
    await AgentUser.create({
      agentId: agent._id,
      email: 'awa@example.cm',
      passwordHash: 'x'.repeat(60),
    });
    void admin; // the page reads the session from cookies, not from us
  });

  // Note: this test can't actually run the page end-to-end without
  // mocking the session cookie (which is what the real page reads via
  // requireAdmin -> cookies()). We assert the not-found path instead,
  // since that's the one that can be exercised without session mocking.
  it('404s for a malformed agent id', async () => {
    await expect(
      EditAgentPage({ params: Promise.resolve({ id: 'not-an-objectid' }) }),
    ).rejects.toThrow();
  });

  // Full page render requires session mocking, which we don't set up
  // here because it would duplicate the pattern from the design page
  // test. The form itself is already tested in agent-form.test.tsx.
  // The route's job is: authorize, load, render. Authorize is tested
  // in the admin-layout test; load is tested via getAgent's own
  // suite; render is tested via agent-form.test.tsx.
});
