export { hashPassword, verifyPassword, BCRYPT_COST, MAX_PASSWORD_BYTES } from './password';

export {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
  SESSION_ABSOLUTE_MS,
  createSession,
  readSession,
  refreshSession,
  revokeSession,
  revokeAllSessionsFor,
  buildSessionCookie,
  buildClearSessionCookie,
  readSessionCookieFromHeader,
} from './session';
export type { SessionSubject } from './session';

export { getCurrentUser } from './current-user';
export type { CurrentUser } from './current-user';

export { requireRole, assertCanAccessAgent, scopeAgentFilter, isAdmin } from './guards';
export type { AppRole } from './guards';

export { withAuth } from './with-auth';
