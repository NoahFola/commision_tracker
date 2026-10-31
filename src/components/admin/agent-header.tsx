import Link from 'next/link';
import { AgentStatusBadge } from '../primitives/status-badge';
import { Button, ButtonLink } from '../primitives/button';
import type { AgentDetail } from '@/types/agent';

/**
 * The agent detail header. Name, type badge, status badge, region,
 * joined date, referral code, and the two top-bar actions.
 *
 * The action buttons are passed in as props so the page can wire them
 * to the terminate/suspend dialogs. This component is presentational.
 */
export function AgentHeader({
  agent,
  actions,
}: {
  agent: AgentDetail;
  actions: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-text-primary">
              {agent.fullName}
            </h1>
            <span className="inline-flex items-center rounded-full border border-border-default px-2 py-0.5 text-xs font-medium text-text-secondary">
              {agent.type === 'AGENT' ? 'Agent' : 'Ambassador'}
            </span>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {agent.region.name} · joined {formatShortDate(agent.dateJoined)} · referral code{' '}
            <code className="font-mono text-xs">{agent.referralCode}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${shifted.getUTCDate()} ${months[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}`;
}