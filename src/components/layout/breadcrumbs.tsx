'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Breadcrumbs computed from the current pathname. Every segment except
 * the last is a link. The last segment is the current page.
 *
 *   /admin/agents            -> Agents
 *   /admin/agents/abc123     -> Agents / abc123
 *   /admin/commissions/xyz   -> Commissions / xyz
 *
 * Human-readable labels come from a small map for known segments; an
 * unknown segment is shown as-is (used for ids).
 */
const LABELS: Record<string, string> = {
  admin: 'Admin',
  agents: 'Agents',
  regions: 'Regions',
  commissions: 'Commissions',
  'payout-batches': 'Payout batches',
  reports: 'Reports',
  new: 'New',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Drop the leading `admin`.
  const parts = segments.slice(1);

  // Root of /admin: no breadcrumb to show.
  if (parts.length === 0) {
    return <span className="text-sm font-medium text-text-primary">Dashboard</span>;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {parts.map((part, i) => {
        const href = '/admin/' + parts.slice(0, i + 1).join('/');
        const isLast = i === parts.length - 1;
        const label = LABELS[part] ?? part;
        return (
          <span key={href} className="flex items-center gap-2">
            {i > 0 && <span className="text-text-tertiary">/</span>}
            {isLast ? (
              <span className="font-medium text-text-primary">{label}</span>
            ) : (
              <Link
                href={href}
                className="focus-ring rounded text-text-secondary hover:text-text-primary"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
