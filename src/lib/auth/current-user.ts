import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Admin } from '@/models/admin.model';
import { Agent } from '@/models/agent.model';
import { readSession, readSessionCookieFromHeader } from './session';
import type { AuthMe } from '@/types/auth';

export type CurrentUser = AuthMe | null;

/**
 * Resolves the caller from the request cookie. The single source of truth
 * for "who is calling", used by /api/auth/me and every protected route.
 *
 * Returns null when:
 *   - no cookie
 *   - unknown/expired session
 *   - the subject no longer exists
 *   - the subject is an Agent whose status is not ACTIVE
 *
 * Callers must check for null and respond 401. Never trust client-supplied
 * identity; the session cookie is the only credential.
 */
export async function getCurrentUser(request: Request): Promise<CurrentUser> {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = readSessionCookieFromHeader(cookieHeader);
  if (!sessionId) return null;

  const session = await readSession(sessionId);
  if (!session) return null;

  await connectDb();

  if (session.subjectType === 'ADMIN') {
    const admin = await Admin.findById(session.subjectId).lean<{
      _id: Types.ObjectId;
      email: string;
      name: string;
      profilePictureUrl?: string | null;
    }>();
    if (!admin) return null;
    return {
      subjectType: 'ADMIN',
      subjectId: String(admin._id),
      email: admin.email,
      name: admin.name,
      profilePictureUrl: admin.profilePictureUrl ?? null,
      roles: ['ADMIN'],
    };
  }

  const agent = await Agent.findById(session.subjectId).lean<{
    _id: Types.ObjectId;
    email: string;
    fullName: string;
    type: 'AGENT' | 'AMBASSADOR';
    status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';
    profilePictureUrl?: string | null;
    referralCode: string;
  }>();
  if (!agent) return null;
  if (agent.status !== 'ACTIVE') return null;

  return {
    subjectType: 'AGENT',
    subjectId: String(agent._id),
    email: agent.email,
    name: agent.fullName,
    profilePictureUrl: agent.profilePictureUrl ?? null,
    roles: [agent.type],
    agentId: String(agent._id),
    agentType: agent.type,
    referralCode: agent.referralCode,
  };
}
