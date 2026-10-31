import { BadRequestError } from '@/lib/errors/app-error';

export type CreateRegionBody = {
  name: string;
  code?: string;
  isActive?: boolean;
};

export type ListRegionsQuery = {
  isActive?: boolean;
};

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestError('Invalid body');
  }
  return input as Record<string, unknown>;
}

function requireString(v: unknown, field: string, max = 200): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new BadRequestError(`${field} is required`);
  }
  if (v.length > max) throw new BadRequestError(`${field} is too long`);
  return v.trim();
}

function optionalString(v: unknown, field: string, max = 100): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new BadRequestError(`${field} must be a string`);
  if (v.length > max) throw new BadRequestError(`${field} is too long`);
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

export function parseCreateRegionBody(input: unknown): CreateRegionBody {
  const o = asObject(input);
  const body: CreateRegionBody = {
    name: requireString(o.name, 'name', 200),
  };
  const code = optionalString(o.code, 'code', 20);
  if (code !== undefined) body.code = code.toUpperCase();
  // AFTER (correct — rejects non-boolean, accepts undefined)
  if (o.isActive !== undefined) {
    if (typeof o.isActive !== 'boolean') {
      throw new BadRequestError('isActive must be a boolean');
    }
    body.isActive = o.isActive;
  }
  return body;
}

/**
 * Reads `?isActive=true|false` from the URL. Absent means "no filter".
 * Anything else is a 400 — we do not silently ignore an unparseable flag.
 */
export function parseListRegionsQuery(url: URL): ListRegionsQuery {
  const raw = url.searchParams.get('isActive');
  if (raw === null) return {};
  if (raw === 'true') return { isActive: true };
  if (raw === 'false') return { isActive: false };
  throw new BadRequestError('isActive must be true or false');
}
