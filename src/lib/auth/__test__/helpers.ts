import { Types } from 'mongoose';
import { Admin } from '@/models/admin.model';
import { Agent } from '@/models/agent.model';
import { Region } from '@/models/region.model';
import { createSession, SESSION_COOKIE_NAME } from '../session';

/** Build a Request with a JSON body and optional session cookie. */
export function jsonRequest(
  url: string,
  body: unknown,
  init: { method?: string; cookie?: string } = {},
): Request {
  return new Request(url, {
    method: init.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.cookie ? { cookie: `${SESSION_COOKIE_NAME}=${init.cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Build a Request with no body and an optional session cookie. */
export function bareRequest(url: string, init: { method?: string; cookie?: string } = {}): Request {
  return new Request(url, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.cookie ? { cookie: `${SESSION_COOKIE_NAME}=${init.cookie}` } : {}),
    },
  });
}

/** Extracts the Set-Cookie header value for our session cookie, or null. */
export function setCookieFor(response: Response, name = SESSION_COOKIE_NAME): string | null {
  const cookies = response.headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    if (c.startsWith(`${name}=`)) return c;
  }
  // Fallback for environments where getSetCookie is unavailable.
  const single = response.headers.get('set-cookie');
  return single && single.startsWith(`${name}=`) ? single : null;
}

/** Creates a Region + Agent directly (no routes exist for these yet). */
export async function createAgent(overrides: Partial<Record<string, unknown>> = {}) {
  const region = await Region.create({ name: `Region-${new Types.ObjectId().toHexString()}` });
  return Agent.create({
    fullName: 'Awa Ngwa',
    type: 'AGENT',
    email: `agent-${new Types.ObjectId().toHexString()}@example.cm`,
    phone: `+2376${Math.floor(Math.random() * 1e8)
      .toString()
      .padStart(8, '0')}`,
    regionId: region._id,
    referralCode: `REF-${new Types.ObjectId().toHexString().slice(0, 8)}`,
    status: 'ACTIVE',
    payoutPreference: { method: 'MOBILE_MONEY' },
    ...overrides,
  });
}

/** Creates an Admin with a bcrypt hash of `password`. */
export async function createAdmin(email: string, password: string, name = 'Ops Lead') {
  const { hashPassword } = await import('../password');
  const passwordHash = await hashPassword(password);
  return Admin.create({ email, passwordHash, name });
}

/** Plants a valid session for a subject and returns the session ID. */
export async function plantSession(
  subjectType: 'ADMIN' | 'AGENT',
  subjectId: Types.ObjectId | string,
): Promise<string> {
  const { sessionId } = await createSession({
    type: subjectType,
    id: typeof subjectId === 'string' ? new Types.ObjectId(subjectId) : subjectId,
  });
  return sessionId;
}
