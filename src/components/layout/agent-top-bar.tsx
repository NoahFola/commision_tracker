import Link from 'next/link';
import type { AuthMe } from '@/types/auth';
import { LogoutButton } from '../auth/logout-button';

/**
 * The agent portal top bar. Shows the app logo, and on desktop, the
 * signed-in user's name and a logout action. On mobile, the top bar
 * shows only the logo — the bottom nav handles the rest.
 */
export function AgentTopBar({ user }: { user: AuthMe }) {
  return (
    <header className="border-b border-border-default bg-surface">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="focus-ring flex items-center gap-2 rounded"
          aria-label="EpsiHome Tracker home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded bg-btn-primary-bg text-xs font-semibold text-btn-primary-fg">
            E
          </span>
          <span className="text-sm font-semibold">EpsiHome Tracker</span>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-text-secondary">{user.name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
