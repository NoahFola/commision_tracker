import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from './current-user';
import { SESSION_COOKIE_NAME } from './session';
import type { AuthMe, AuthMeAdmin } from '@/types/auth';

/**
 * Server-component wrapper around getCurrentUser. Reads the incoming
 * cookie header via next/headers and synthesizes a Request so
 * getCurrentUser can be reused unchanged.
 *
 * Returns null when unauthenticated.
 */
export async function getSessionUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;

  const cookieHeader = `${SESSION_COOKIE_NAME}=${sessionCookie.value}`;
  const syntheticRequest = new Request('http://internal/', {
    headers: { cookie: cookieHeader },
  });
  return getCurrentUser(syntheticRequest);
}

/**
 * Like getSessionUser, but redirects to /login when unauthenticated.
 */
export async function requireSessionUser(): Promise<AuthMe> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Requires an authenticated admin. Redirects:
 *   - unauthenticated -> /login
 *   - agent (authenticated, wrong role) -> / (the agent home)
 *
 * Use this at the top of every admin page or in the admin layout.
 * The layout already calls it; individual pages may call it again for
 * type narrowing, which costs nothing.
 */
export async function requireAdmin(): Promise<AuthMeAdmin> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.subjectType !== 'ADMIN') redirect('/');
  return user;
}
