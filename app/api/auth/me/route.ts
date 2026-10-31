import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { ok, toErrorResponse } from '@/lib/errors/respond';
import { UnauthorizedError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedError('Not authenticated');
    }
    return ok(user);
  } catch (err) {
    return toErrorResponse(err);
  }
}
