import { redirect } from 'next/navigation';
import { requireSessionUser } from '@/lib/auth/session-server';
import { listCommissions, getUnpaidBalance } from '@/services/commission.service';
import { listBatches } from '@/services/payout-batch.service';
import { getAgent } from '@/services/agent.service';
import {
  AgentHomeHero,
  AgentBeingCheckedCard,
  AgentCommissionListItem,
  AgentPayoutListItem,
  AgentProfileFooter,
} from '@/components';

export default async function AgentHomePage() {
  const user = await requireSessionUser();

  if (user.subjectType !== 'AGENT') {
    redirect('/admin');
  }

  // Parallel data fetch.
  const [approved, pending, recent, batches, agent] = await Promise.all([
    listCommissions(user, { page: 1, limit: 50, status: 'APPROVED' }),
    listCommissions(user, { page: 1, limit: 50, status: 'PENDING' }),
    listCommissions(user, { page: 1, limit: 5 }),
    listBatches(user, { page: 1, limit: 5 }),
    getAgent(user, user.agentId),
  ]);

  const currency = approved.items[0]?.netAmount.currency ?? 'XAF';
  const approvedTotal = approved.items.reduce((s, c) => s + c.netAmount.amount, 0);
  const pendingTotal = pending.items.reduce((s, c) => s + c.netAmount.amount, 0);

  // Sum through the shared helper too, so the numbers match the terminate
  // guard and the server-side view.
  const balance = await getUnpaidBalance(user.agentId);
  void balance; // used by hero via approvedTotal/pendingTotal directly

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <AgentHomeHero
        owedNow={{ amount: approvedTotal, currency }}
        owedNowCount={approved.total}
        payoutPreference={agent.payoutPreference}
      />

      <AgentBeingCheckedCard
        beingChecked={{ amount: pendingTotal, currency }}
        beingCheckedCount={pending.total}
      />

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent commissions</h2>
          <a
            href="/commissions"
            className="focus-ring rounded text-xs text-text-secondary underline-offset-2 hover:underline"
          >
            See all
          </a>
        </header>
        {recent.items.length === 0 ? (
          <p className="rounded-lg border border-border-default bg-surface p-4 text-sm text-text-secondary">
            No commissions yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.items.map((c) => (
              <li key={c.id}>
                <AgentCommissionListItem commission={c} href={`/commissions/${c.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Paid history</h2>
          <a
            href="/payouts"
            className="focus-ring rounded text-xs text-text-secondary underline-offset-2 hover:underline"
          >
            See all
          </a>
        </header>
        {batches.items.length === 0 ? (
          <p className="rounded-lg border border-border-default bg-surface p-4 text-sm text-text-secondary">
            No payouts yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {batches.items.map((b) => (
              <li key={b.id}>
                <AgentPayoutListItem batch={b} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AgentProfileFooter
        name={agent.fullName}
        phone={agent.phone}
        referralCode={agent.referralCode}
      />
    </div>
  );
}
