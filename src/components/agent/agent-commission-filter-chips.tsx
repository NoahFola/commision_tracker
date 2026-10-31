'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'being-checked', label: 'Being checked' },
  { key: 'ready-to-pay', label: 'Ready to pay' },
  { key: 'paid', label: 'Paid' },
] as const;

export type CommissionChip = (typeof CHIPS)[number]['key'];

/**
 * Filter chips for the agent commissions page. Written to the URL as
 * ?filter=<key>. Admin-friendly, shareable.
 */
export function AgentCommissionFilterChips({ current }: { current: CommissionChip }) {
  const pathname = usePathname();
  const search = useSearchParams();

  function hrefFor(key: CommissionChip): string {
    const params = new URLSearchParams(search.toString());
    if (key === 'all') params.delete('filter');
    else params.set('filter', key);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {CHIPS.map((chip) => {
        const active = chip.key === current;
        return (
          <Link
            key={chip.key}
            href={hrefFor(chip.key)}
            role="tab"
            aria-selected={active}
            className={[
              'focus-ring rounded-full border px-3 py-1.5 text-sm',
              active
                ? 'border-success-fg bg-success-fg text-white'
                : 'border-border-default bg-surface text-text-secondary hover:bg-surface-muted',
            ].join(' ')}
          >
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
