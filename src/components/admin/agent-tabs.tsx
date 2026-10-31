'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'performance', label: 'Performance' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'audit', label: 'Audit' },
] as const;

export type AgentTabKey = (typeof TABS)[number]['key'];

/**
 * The four-tab bar. Active tab is driven by the `?tab=` search param.
 * Defaults to "profile" when absent.
 */
export function AgentTabs({ current }: { current: AgentTabKey }) {
  const pathname = usePathname();
  const search = useSearchParams();

  function hrefFor(key: AgentTabKey) {
    const params = new URLSearchParams(search.toString());
    params.set('tab', key);
    // Any tab change resets pagination on the tab that has it.
    params.delete('page');
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="mb-6 border-b border-border-default">
      <nav aria-label="Agent sections" className="-mb-px flex gap-1">
        {TABS.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={hrefFor(tab.key)}
              aria-current={active ? 'page' : undefined}
              className={[
                'focus-ring rounded-t border-b-2 px-4 py-2 text-sm font-medium',
                active
                  ? 'border-success-fg text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
