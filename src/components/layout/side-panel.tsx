import type { ReactNode } from 'react';

/**
 * An informational panel that appears beside a form. Not a form
 * element; purely explanatory.
 */
export function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded border border-border-default bg-surface-muted p-5">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="mt-3 text-sm text-text-secondary">{children}</div>
    </aside>
  );
}
