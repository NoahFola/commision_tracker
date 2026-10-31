import { NextResponse } from 'next/server';
import {
  revokeSession,
  buildClearSessionCookie,
  readSessionCookieFromHeader,
} from '@/lib/auth/session';
import { ok, toErrorResponse } from '@/lib/errors/respond';

export const dynamic = 'force-dynamic';

/**
 * Logs out the caller. Idempotent: logging out when not logged in still
 * succeeds and clears the cookie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const sessionId = readSessionCookieFromHeader(request.headers.get('cookie'));
    if (sessionId) {
      await revokeSession(sessionId);
    }
    const response = ok({ loggedOut: true as const });
    response.headers.append('Set-Cookie', buildClearSessionCookie());
    return response;
  } catch (err) {
    return toErrorResponse(err);
  }
}
