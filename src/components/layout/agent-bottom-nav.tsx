'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Home', icon: <HomeIcon /> },
  { href: '/commissions', label: 'Commissions', icon: <ListIcon /> },
  { href: '/payouts', label: 'Payouts', icon: <WalletIcon /> },
  { href: '/performance', label: 'Performance', icon: <ChartIcon /> },
] as const;

/**
 * Fixed bottom navigation for the agent portal. Visible only on mobile
 * (< md breakpoint). On desktop, the top bar carries identity and the
 * page itself is wide enough to show everything inline.
 *
 * Active tab:
 *   - '/' is active only on the exact root.
 *   - All other paths are active when the path starts with them
 *     (so /commissions/[id] keeps Commissions highlighted).
 */
export function AgentBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Agent navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border-default bg-surface md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'focus-ring flex flex-col items-center gap-1 py-2 text-xs',
                  active ? 'text-success-fg' : 'text-text-secondary',
                ].join(' ')}
              >
                <span aria-hidden="true" className="h-5 w-5">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M16 12a2 2 0 1 0 0 .01" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="20" x2="21" y2="20" />
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="10" y1="20" x2="10" y2="8" />
      <line x1="15" y1="20" x2="15" y2="14" />
      <line x1="20" y1="20" x2="20" y2="4" />
    </svg>
  );
}
