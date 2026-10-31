import type { ReactNode } from 'react';
import { TopBar } from './top-bar';

/**
 * The wrapper every admin page uses. Renders the top bar (with the
 * action the page supplies) and a body with a title and optional
 * subtitle.
 *
 * Usage:
 *   <PageShell
 *     title="Agents"
 *     subtitle="24 agents and ambassadors across 7 regions"
 *     action={<ButtonLink href="/admin/agents/new" variant="primary">New agent</ButtonLink>}
 *   >
 *     {/* table or content *\/}
 *   </PageShell>
 */
export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar action={action} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
