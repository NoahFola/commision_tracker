import { Types } from 'mongoose';
import { BadRequestError } from '@/lib/errors/app-error';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type ListAuditQuery = {
  entityType: string;
  entityId: string;
  page: number;
  limit: number;
};

export function parseListAuditQuery(url: URL): ListAuditQuery {
  const entityTypeRaw = url.searchParams.get('entityType');
  if (!entityTypeRaw || entityTypeRaw.trim().length === 0) {
    throw new BadRequestError('entityType is required');
  }
  if (entityTypeRaw.length > 100) {
    throw new BadRequestError('entityType is too long');
  }

  const entityIdRaw = url.searchParams.get('entityId');
  if (!entityIdRaw || entityIdRaw.trim().length === 0) {
    throw new BadRequestError('entityId is required');
  }
  if (!Types.ObjectId.isValid(entityIdRaw)) {
    throw new BadRequestError('entityId is not a valid identifier');
  }

  const pageRaw = url.searchParams.get('page') ?? '1';
  const page = Number.parseInt(pageRaw, 10);
  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestError('page must be a positive integer');
  }

  const limitRaw = url.searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE);
  const limit = Number.parseInt(limitRaw, 10);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE ||
    !(PAGE_SIZE_OPTIONS as readonly number[]).includes(limit)
  ) {
    throw new BadRequestError(`limit must be one of: ${PAGE_SIZE_OPTIONS.join(', ')}`);
  }

  return {
    entityType: entityTypeRaw.trim(),
    entityId: entityIdRaw,
    page,
    limit,
  };
}
