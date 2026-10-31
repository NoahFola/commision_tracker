import { connectDb } from '@/lib/db/mongoose';
import { Region } from '@/models/region.model';
import { ConflictError } from '@/lib/errors/app-error';
import type { RegionView } from '@/types/region';
import type { CreateRegionBody, ListRegionsQuery } from '@/lib/validation/region';

/**
 * Region business logic.
 *
 * Regions are configuration, not financial or performance data.
 * They are not audited (S1). Duplicate names are case-insensitive
 * via the schema's `nameKey` index and surface as 409 Conflict.
 */

function toView(doc: {
  _id: unknown;
  name: string;
  code?: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): RegionView {
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code ?? null,
    isActive: doc.isActive,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

export async function createRegion(body: CreateRegionBody): Promise<RegionView> {
  await connectDb();
  try {
    const doc = await Region.create({
      name: body.name,
      code: body.code,
      isActive: body.isActive ?? true,
    });
    return toView(doc as unknown as Parameters<typeof toView>[0]);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError('A region with this name already exists');
    }
    throw err;
  }
}

export async function listRegions(query: ListRegionsQuery): Promise<RegionView[]> {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const docs = await Region.find(filter).sort({ name: 1 }).lean().exec();
  return docs.map((d) => toView(d as unknown as Parameters<typeof toView>[0]));
}

/** Narrow a MongoDB duplicate-key error (code 11000) without using `any`. */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}
