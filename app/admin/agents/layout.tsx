import type { ReactNode } from 'react';
import { requireSessionUser } from '@/lib/auth/session-server';
import { AgentTopBar } from '@/components/layout/agent-top-bar';
import { AgentBottomNav } from '@/components/layout/agent-bottom-nav';

/**
 * Agent portal layout. Enforces authentication in one place; every page
 * under /(agent) inherits it.
 *
 * Two nav surfaces:
 *   - Desktop / tablet: a simple top bar (logo + user menu).
 *   - Mobile: a fixed bottom tab bar (Home / Commissions / Payouts /
 *     Performance), matching the mockup.
 *
 * The role guard here is requireSessionUser (both admin and agent may
 * pass) but the agent pages assume the caller is an agent — they call
 * getAgent(user, user.subjectId) which only works for agents. A logged-in
 * admin visiting / will be redirected to /admin by the root page logic
 * (see app/(agent)/page.tsx).
 */
export default async function AgentLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AgentTopBar user={user} />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <AgentBottomNav />
    </div>
  );
}
