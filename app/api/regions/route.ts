import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { parseCreateRegionBody, parseListRegionsQuery } from '@/lib/validation/region';
import { createRegion, listRegions } from '@/services/region.service';
import { ok } from '@/lib/errors/respond';
import { BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/regions
 * Admin-only. Returns all regions, sorted by name.
 * Optional ?isActive=true|false filter.
 */
export const GET = withAuth(['ADMIN'], async (request, _context): Promise<NextResponse> => {
  const url = new URL(request.url);
  const query = parseListRegionsQuery(url);
  const items = await listRegions(query);
  return ok({ items });
});

/**
 * POST /api/regions
 * Admin-only. Creates a region. Case-insensitive duplicate names -> 409.
 */
export const POST = withAuth(['ADMIN'], async (request, _context): Promise<NextResponse> => {
  const raw = await request.json().catch(() => {
    throw new BadRequestError('Invalid JSON body');
  });
  const body = parseCreateRegionBody(raw);
  const created = await createRegion(body);
  return ok(created, { status: 201 });
});
