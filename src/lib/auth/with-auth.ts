import { NextResponse } from 'next/server';
import { requireRole, type AppRole } from './guards';
import { toErrorResponse } from '@/lib/errors/respond';
import type { AuthMe } from '@/types/auth';

/**
 * A Next.js Route Handler signature, parameterized on the route context.
 * Next 15+ hands `context.params` as a Promise; we preserve that shape so
 * dynamic segments (`/api/agents/[id]`) still type correctly.
 */
type RouteContext<P = Record<string, string>> = { params: Promise<P> };

/**
 * The inner handler with the resolved user in scope. `user` is guaranteed
 * non-null and role-checked. No route wrapped by `withAuth` needs to call
 * `getCurrentUser` or `requireRole` itself.
 */
type AuthorizedHandler<P> = (
  request: Request,
  context: RouteContext<P>,
  user: AuthMe,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with authentication + role enforcement.
 *
 *   export const GET = withAuth(['ADMIN'], async (request, ctx, user) => {
 *     // user is guaranteed to be an authenticated ADMIN
 *   });
 *
 * Unauthenticated → 401. Wrong role → 403. Handler never runs in either case.
 * Any thrown AppError is mapped to the standard envelope via toErrorResponse,
 * so handlers just throw the right error and don't hand-roll responses.
 *
 * There is no way to bypass the check from outside: the export itself is
 * the gate. A route that forgets withAuth is a route that doesn't exist yet.
 */
export function withAuth<P = Record<string, string>>(
  allowed: readonly AppRole[],
  handler: AuthorizedHandler<P>,
) {
  return async (request: Request, context: RouteContext<P>): Promise<NextResponse> => {
    try {
      const user = await requireRole(request, allowed);
      return await handler(request, context, user);
    } catch (err) {
      const requestId = request.headers.get('x-request-id') ?? undefined;
      return toErrorResponse(err, requestId);
    }
  };
}
