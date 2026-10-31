import Link from 'next/link';
import { OnboardingStageIndicator } from '../onboarding-stage-indicator';
import { AgentTerminateDialog } from './agent-terminate-dialog';
import type { AgentDetail } from '@/types/agent';
import type { OnboardingHistory } from '@/services/agent.service';

/**
 * Profile tab: contact, status and onboarding (with history), payout
 * preference, terminate section.
 */
export function AgentProfileTab({
  agent,
  onboarding,
}: {
  agent: AgentDetail;
  onboarding: OnboardingHistory;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded border border-border-default bg-surface p-5">
        <h2 className="text-base font-semibold">Contact</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Full name" value={agent.fullName} />
          <Row label="Phone" value={agent.phone} />
          <Row label="Email" value={agent.email} />
          <Row label="Region" value={agent.region.name} />
          <Row label="Type" value={agent.type === 'AGENT' ? 'Agent' : 'Ambassador'} />
          <Row label="Referral code" value={agent.referralCode} mono />
        </dl>
      </section>

      <section className="rounded border border-border-default bg-surface p-5">
        <h2 className="text-base font-semibold">Status and onboarding</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Suspended and Inactive both return through Active. Terminated is final.
        </p>
        <div className="mt-4">
          <OnboardingStageIndicator
            stage={agent.onboardingStage}
            variant="full"
            transitions={onboarding.transitions}
          />
        </div>
      </section>

      <section className="rounded border border-border-default bg-surface p-5">
        <h2 className="text-base font-semibold">Payout preference</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row
            label="Method"
            value={
              agent.payoutPreference.method === 'MOBILE_MONEY'
                ? 'Mobile money'
                : agent.payoutPreference.method === 'BANK'
                  ? 'Bank transfer'
                  : 'Cash'
            }
          />
          {agent.payoutPreference.provider && (
            <Row label="Provider" value={agent.payoutPreference.provider} />
          )}
          {agent.payoutPreference.accountNumber && (
            <Row label="Account number" value={agent.payoutPreference.accountNumber} mono />
          )}
          {agent.payoutPreference.accountName && (
            <Row label="Account name" value={agent.payoutPreference.accountName} />
          )}
          <Row label="Default" value={agent.payoutPreference.isDefault ? 'Yes' : 'No'} />
        </dl>
        <p className="mt-3 text-xs text-text-tertiary">
          <Link
            href={`/admin/agents/${agent.id}/edit`}
            className="focus-ring rounded underline-offset-2 hover:underline"
          >
            Edit profile
          </Link>
        </p>
      </section>

      <section className="rounded border border-border-default bg-surface p-5">
        <h2 className="text-base font-semibold">Terminate agent</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Terminating sets the status to Terminated. The agent can no longer
          sign in. This cannot be undone.
        </p>
        <div className="mt-3">
          {agent.status === 'TERMINATED' ? (
            <p className="text-sm text-text-tertiary">This agent is terminated.</p>
          ) : (
            <AgentTerminateDialog agent={agent} />
          )}
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className={mono ? 'font-mono' : ''}>{value}</dd>
    </div>
  );
}