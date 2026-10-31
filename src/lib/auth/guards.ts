import { Types } from 'mongoose';
import { getCurrentUser, type CurrentUser } from './current-user';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/app-error';
import type { AuthMe } from '@/types/auth';

/**
 * All role tokens the app recognizes. Kept as a type so future roles
 * (Finance, Team Lead) don't force a rewrite — they get added here and
 * every wrapper call site keeps working.
 */
export type AppRole = 'ADMIN' | 'AGENT' | 'AMBASSADOR';

/**
 * Resolves the caller and asserts the role. Throws:
 *   - UnauthorizedError (401) if not authenticated.
 *   - ForbiddenError (403) if authenticated but not in `allowed`.
 *
 * Prefer withAuth() over calling this directly — withAuth makes the check
 * structurally impossible to forget.
 */
export async function requireRole(request: Request, allowed: readonly AppRole[]): Promise<AuthMe> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new UnauthorizedError('Not authenticated');
  }
  const roles = user.roles as readonly AppRole[];
  const permitted = roles.some((r) => allowed.includes(r));
  if (!permitted) {
    throw new ForbiddenError('Forbidden');
  }
  return user;
}

/**
 * Scope predicate: "may `user` read/write data belonging to agentId?"
 *
 * Rules:
 *   - ADMIN  — yes, any agent.
 *   - AGENT  — only their own agentId.
 *
 * Used by Phases 3–8 for object-level authorization. Callers MUST also
 * narrow their DB queries — this predicate is a check, not a filter.
 * The companion filter builder (scopeAgentFilter) exists for that.
 */
export function assertCanAccessAgent(user: AuthMe, agentId: Types.ObjectId | string): void {
  if (user.subjectType === 'ADMIN') return;
  const requested = String(agentId);
  if (requested !== user.agentId) {
    throw new ForbiddenError('Forbidden');
  }
}

/**
 * Scope filter builder: returns a Mongo filter that restricts any query
 * to what `user` is allowed to see for Agent-owned records.
 *
 *   const filter = scopeAgentFilter(user, { status: 'ACTIVE' });
 *   Agent.find(filter)
 *
 * - ADMIN  — returns the base filter unchanged (sees everything).
 * - AGENT  — narrows to { ...base, _id: user.agentId }.
 *
 * Building queries through this helper makes whole-agent data leaks
 * impossible by construction, not by discipline.
 */
export function scopeAgentFilter<T extends Record<string, unknown>>(
  user: AuthMe,
  base: T,
): T & { _id?: Types.ObjectId } {
  if (user.subjectType === 'ADMIN') return base;
  return { ...base, _id: new Types.ObjectId(user.agentId) };
}

/**
 * Convenience predicate for "is this user an admin?".
 * Used in handlers where the distinction is meaningful (e.g. showing
 * admin-only actions in a response), not as an authorization check —
 * use requireRole('ADMIN') for that.
 */
export function isAdmin(user: AuthMe): boolean {
  return user.subjectType === 'ADMIN';
}

// Re-export for ergonomics so callers can import everything auth-related
// from one place if they prefer.
export type { CurrentUser };
