import Link from 'next/link';
import { LogoutButton } from '../auth/logout-button';
import { SidebarNav } from './sidebar-nav';
import type { AuthMeAdmin } from '@/types/auth';

/**
 * The admin sidebar. Six navigation items on the left, the signed-in
 * admin in the footer.
 *
 * The active-item highlighting is client-side (reads usePathname), so
 * the nav list lives in a small client subcomponent. Everything else
 * here is a server component.
 */
export function Sidebar({ user }: { user: AuthMeAdmin }) {
  return (
    <aside data-print-hide="true" className="hidden w-56 shrink-0 border-r border-border-default bg-surface md:flex md:flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-btn-primary-bg text-xs font-semibold text-btn-primary-fg">
          E
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">EpsiHome</p>
          <p className="text-xs text-text-secondary">Tracker</p>
        </div>
      </div>

      <SidebarNav />

      <div className="mt-auto border-t border-border-default px-4 py-3">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-xs text-text-secondary">Admin</p>
        <p className="mt-2">
          <LogoutButton />
        </p>
      </div>
    </aside>
  );
}
