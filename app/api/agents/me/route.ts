import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseUpdateMyProfileBody } from '@/lib/validation/agent';
import { updateOwnProfile } from '@/services/agent.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/agents/me
 * The agent editing their own profile. Only `phone`, `payoutPreference`,
 * and `profilePictureUrl` are accepted; everything else is rejected with
 * 400 naming the field.
 *
 * Admin sessions get 403 — admins use PATCH /api/agents/[id].
 */
export const PATCH = withAuth(['AGENT'], async (request, _context, user): Promise<NextResponse> => {
  const raw = await request.json().catch(() => {
    throw new BadRequestError('Invalid JSON body');
  });
  const body = parseUpdateMyProfileBody(raw);
  const updated = await updateOwnProfile(user, body);
  return ok(updated);
});
