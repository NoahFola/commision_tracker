import { requireSessionUser } from '@/lib/auth/session-server';
import { getAgent } from '@/services/agent.service';
import { AgentProfileForm } from '@/components';

export default async function AgentProfilePage() {
  const user = await requireSessionUser();
  if (user.subjectType !== 'AGENT') return null;

  const agent = await getAgent(user, user.agentId);

  const initials = agent.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">My profile</h1>
      </header>

      <section className="rounded-lg border border-border-default bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-base font-semibold text-success-fg">
            {initials}
          </span>
          <div>
            <p className="text-base font-medium">{agent.fullName}</p>
          </div>
        </div>
        {/* "Change picture" is deferred — the API accepts profilePictureUrl
            but the design's picture-upload UI is not scoped yet. */}
      </section>

      <section className="rounded-lg border border-border-default bg-surface p-5">
        <h2 className="text-base font-semibold">Set by EpsiHome</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Email" value={agent.email} />
          <Row label="Region" value={agent.region.name} />
          <Row label="Referral code" value={agent.referralCode} mono />
        </dl>
        <p className="mt-3 text-xs text-text-tertiary">Only an administrator can change these.</p>
      </section>

      <AgentProfileForm
        initialPhone={agent.phone}
        initialPayoutPreference={{
          method: agent.payoutPreference.method,
          provider: agent.payoutPreference.provider ?? '',
          accountNumber: agent.payoutPreference.accountNumber ?? '',
          accountName: agent.payoutPreference.accountName ?? '',
        }}
      />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}
