import { requireSessionUser } from '@/lib/auth/session-server';
import { listBatches } from '@/services/payout-batch.service';
import { AgentPayoutListItem } from '@/components';

export default async function AgentPayoutsPage() {
  const user = await requireSessionUser();
  if (user.subjectType !== 'AGENT') return null;

  const [processing, paidHistory] = await Promise.all([
    listBatches(user, { page: 1, limit: 5, status: 'PROCESSING' }),
    listBatches(user, { page: 1, limit: 20, status: 'PAID' }),
  ]);

  const paidTotal = paidHistory.items.reduce((s, b) => s + b.totalAmount.amount, 0);
  const currency = paidHistory.items[0]?.totalAmount.currency ?? 'XAF';

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">My payouts</h1>
      </header>

      {processing.items.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium">Being prepared</h2>
          <ul className="space-y-2">
            {processing.items.map((b) => (
              <li key={b.id}>
                <AgentPayoutListItem batch={b} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Paid</h2>
          <span className="text-xs text-text-secondary">
            {paidTotal.toLocaleString('en-US')} {currency} to date
          </span>
        </header>
        {paidHistory.items.length === 0 ? (
          <p className="rounded-lg border border-border-default bg-surface p-4 text-sm text-text-secondary">
            No payouts yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {paidHistory.items.map((b) => (
              <li key={b.id}>
                <AgentPayoutListItem batch={b} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
