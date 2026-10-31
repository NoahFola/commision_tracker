'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const PAGE_SIZES = [5, 10, 25, 30, 50] as const;

/**
 * Pagination for a paginated list. Renders:
 *   - Rows per page select (5/10/25/30/50).
 *   - "X–Y of Z" indicator.
 *   - Previous / Next links.
 *
 * Page and limit are read from / written to the URL.
 */
export function Pagination({ page, limit, total }: { page: number; limit: number; total: number }) {
  const pathname = usePathname();
  const search = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);

  function hrefWith(overrides: { page?: number; limit?: number }) {
    const params = new URLSearchParams(search.toString());
    if (overrides.page !== undefined) params.set('page', String(overrides.page));
    if (overrides.limit !== undefined) {
      params.set('limit', String(overrides.limit));
      params.set('page', '1');
    }
    return `${pathname}?${params.toString()}`;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <label className="flex items-center gap-2 text-text-secondary">
        Rows per page
        <select
          value={limit}
          onChange={(e) => {
            window.location.assign(hrefWith({ limit: Number(e.target.value) }));
          }}
          className="focus-ring rounded border border-border-default bg-surface px-2 py-1 text-sm"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <span className="text-text-secondary">
        {first}–{last} of {total}
      </span>

      <div className="flex items-center gap-2">
        <Link
          href={hrefWith({ page: Math.max(1, page - 1) })}
          aria-disabled={page <= 1}
          className={[
            'focus-ring rounded border border-border-default bg-surface px-3 py-1',
            page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-surface-muted',
          ].join(' ')}
        >
          Previous
        </Link>
        <Link
          href={hrefWith({ page: Math.min(totalPages, page + 1) })}
          aria-disabled={page >= totalPages}
          className={[
            'focus-ring rounded border border-border-default bg-surface px-3 py-1',
            page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-surface-muted',
          ].join(' ')}
        >
          Next
        </Link>
      </div>
    </nav>
  );
}
