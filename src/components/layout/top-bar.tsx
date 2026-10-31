import type { ReactNode } from 'react';
import { Breadcrumbs } from './breadcrumbs';

/**
 * The admin top bar. Breadcrumbs on the left, an optional action slot
 * on the right. The action is supplied by the page (via PageShell).
 */
export function TopBar({ action }: { action?: ReactNode }) {
  return (
    <header data-print-hide="true" className="flex h-14 items-center justify-between gap-4 border-b border-border-default bg-surface px-6">
      <Breadcrumbs />
      <div className="flex items-center gap-2">{action}</div>
    </header>
  );
}
