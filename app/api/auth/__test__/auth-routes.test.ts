import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { Agent } from '@/models/agent.model';
import { AgentUser } from '@/models/agent-user.model';
import { Region } from '@/models/region.model';
import { Session } from '@/models/session.model';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  jsonRequest,
  bareRequest,
  setCookieFor,
  createAgent,
  createAdmin,
  plantSession,
} from '@/lib/auth/__test__/helpers';

import { POST as adminLogin } from '../admin/login/route';
import { POST as agentLogin } from '../agent/login/route';
import { POST as logout } from '../logout/route';
import { GET as me } from '../me/route';
import { wipeAllCollections } from '@/test/helpers/wipe-db';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('auth routes (integration)', () => {
  beforeAll(async () => {
    await connectDb();
  });

  // Intentionally do NOT disconnect — the connection is shared across
  // test files in the worker. See vitest.setup.ts.

  beforeEach(async () => {
    // await Promise.all([
    //   Admin.deleteMany({}),
    //   Agent.deleteMany({}),
    //   AgentUser.deleteMany({}),
    //   Region.deleteMany({}),
    //   Session.deleteMany({}),
    // ]);
    await wipeAllCollections();
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/admin/login
  // ---------------------------------------------------------------------------

  describe('POST /api/auth/admin/login', () => {
    it('logs in a seeded admin and sets a session cookie', async () => {
      await createAdmin('admin@epsihome.cm', 'a-very-strong-password');

      const res = await adminLogin(
        jsonRequest('http://x/api/auth/admin/login', {
          email: 'Admin@EpsiHome.cm',
          password: 'a-very-strong-password',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, data: { subjectType: 'ADMIN' } });

      const cookie = setCookieFor(res);
      expect(cookie).not.toBeNull();
      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(cookie).toContain('HttpOnly');

      const sessionId = cookie!.split(';')[0]!.split('=')[1]!;
      expect(await Session.findById(sessionId)).not.toBeNull();
    });

    it('returns 401 for a wrong password with the generic message', async () => {
      await createAdmin('admin@epsihome.cm', 'a-very-strong-password');

      const res = await adminLogin(
        jsonRequest('http://x/api/auth/admin/login', {
          email: 'admin@epsihome.cm',
          password: 'wrong-password-here',
        }),
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
      expect(setCookieFor(res)).toBeNull();
    });

    it('returns the same generic 401 for an unknown email', async () => {
      const res = await adminLogin(
        jsonRequest('http://x/api/auth/admin/login', {
          email: 'nobody@epsihome.cm',
          password: 'a-very-strong-password',
        }),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toBe('Invalid credentials');
    });

    it('fails closed when the admin has no passwordHash', async () => {
      await Admin.create({ email: 'admin@epsihome.cm', name: 'Ops' });

      const res = await adminLogin(
        jsonRequest('http://x/api/auth/admin/login', {
          email: 'admin@epsihome.cm',
          password: 'anything',
        }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 for a malformed body', async () => {
      const res = await adminLogin(
        new Request('http://x/api/auth/admin/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'not json',
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/agent/login
  // ---------------------------------------------------------------------------

  describe('POST /api/auth/agent/login', () => {
    async function seedAgentWithUser(
      password: string,
      status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED' = 'ACTIVE',
    ) {
      const agent = await createAgent({ status });
      const { hashPassword } = await import('@/lib/auth/password');
      const passwordHash = await hashPassword(password);
      await AgentUser.create({ agentId: agent._id, email: agent.email, passwordHash });
      return agent;
    }

    it('logs in an ACTIVE agent and sets a session cookie', async () => {
      const agent = await seedAgentWithUser('a-very-strong-password');

      const res = await agentLogin(
        jsonRequest('http://x/api/auth/agent/login', {
          email: agent.email,
          password: 'a-very-strong-password',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, data: { subjectType: 'AGENT' } });
      expect(setCookieFor(res)).not.toBeNull();
    });

    it('returns 401 when the agent is SUSPENDED', async () => {
      const agent = await seedAgentWithUser('a-very-strong-password', 'SUSPENDED');

      const res = await agentLogin(
        jsonRequest('http://x/api/auth/agent/login', {
          email: agent.email,
          password: 'a-very-strong-password',
        }),
      );

      expect(res.status).toBe(401);
      expect(setCookieFor(res)).toBeNull();
    });

    it('returns 401 for a wrong password', async () => {
      const agent = await seedAgentWithUser('a-very-strong-password');

      const res = await agentLogin(
        jsonRequest('http://x/api/auth/agent/login', {
          email: agent.email,
          password: 'wrong-password-here',
        }),
      );

      expect(res.status).toBe(401);
    });

    it('returns 401 for an unknown email', async () => {
      const res = await agentLogin(
        jsonRequest('http://x/api/auth/agent/login', {
          email: 'nobody@example.cm',
          password: 'a-very-strong-password',
        }),
      );
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/logout
  // ---------------------------------------------------------------------------

  describe('POST /api/auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const admin = await createAdmin('admin@epsihome.cm', 'a-very-strong-password');
      const sessionId = await plantSession('ADMIN', admin._id);
      expect(await Session.findById(sessionId)).not.toBeNull();

      const res = await logout(
        bareRequest('http://x/api/auth/logout', { method: 'POST', cookie: sessionId }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, data: { loggedOut: true } });

      const cookie = setCookieFor(res);
      expect(cookie).not.toBeNull();
      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=;`);

      expect(await Session.findById(sessionId)).toBeNull();
    });

    it('is idempotent when there is no cookie', async () => {
      const res = await logout(bareRequest('http://x/api/auth/logout', { method: 'POST' }));
      expect(res.status).toBe(200);
      expect(setCookieFor(res)).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/auth/me
  // ---------------------------------------------------------------------------

  describe('GET /api/auth/me', () => {
    it('returns the admin identity for a valid admin session', async () => {
      const admin = await createAdmin('admin@epsihome.cm', 'a-very-strong-password', 'Ops Lead');
      const sessionId = await plantSession('ADMIN', admin._id);

      const res = await me(bareRequest('http://x/api/auth/me', { cookie: sessionId }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.subjectType).toBe('ADMIN');
      expect(body.data.email).toBe('admin@epsihome.cm');
      expect(body.data.name).toBe('Ops Lead');
      expect(body.data.roles).toEqual(['ADMIN']);
      expect(body.data.profilePictureUrl).toBeNull();
    });

    it('returns the agent identity for a valid ACTIVE agent session', async () => {
      const agent = await createAgent();
      const sessionId = await plantSession('AGENT', agent._id);

      const res = await me(bareRequest('http://x/api/auth/me', { cookie: sessionId }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.subjectType).toBe('AGENT');
      expect(body.data.agentId).toBe(String(agent._id));
      expect(body.data.agentType).toBe('AGENT');
      expect(body.data.roles).toEqual(['AGENT']);
    });

    it('returns 401 without a cookie', async () => {
      const res = await me(bareRequest('http://x/api/auth/me'));
      expect(res.status).toBe(401);
    });

    it('returns 401 for a bogus session ID', async () => {
      const res = await me(
        bareRequest('http://x/api/auth/me', { cookie: 'this-session-does-not-exist' }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 for an agent who was suspended after login', async () => {
      const agent = await createAgent({ status: 'ACTIVE' });
      const sessionId = await plantSession('AGENT', agent._id);

      await Agent.updateOne({ _id: agent._id }, { $set: { status: 'SUSPENDED' } });

      const res = await me(bareRequest('http://x/api/auth/me', { cookie: sessionId }));
      expect(res.status).toBe(401);
    });
  });
});
