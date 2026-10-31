import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';

type AttentionRow = {
  id: string;
  fullName: string;
  region: string;
  balance: number;
  currency: string;
  count: number;
};

/**
 * "Agents needing attention" — simplified per D-2. Currently only
 * "agent with unpaid balance" is implemented. The mockup showed four
 * reasons; the other three (failed payout, held by reversal, stalled
 * onboarding) are deferred.
 */
export function DashboardAgentsAttention({ agents }: { agents: AttentionRow[] }) {
  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <header className="mb-3">
        <h2 className="text-base font-semibold">Agents needing attention</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Highest unpaid balances</p>
      </header>

      {agents.length === 0 ? (
        <p className="py-4 text-sm text-text-secondary">No agents currently owed money.</p>
      ) : (
        <ul className="divide-y divide-border-default">
          {agents.map((a) => (
            <li key={a.id} className="py-3">
              <Link
                href={`/admin/agents/${a.id}`}
                className="focus-ring flex items-center justify-between gap-3 rounded"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.fullName}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {a.count} unpaid commission{a.count === 1 ? '' : 's'} · {a.region}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CurrencyAmount
                    value={{ amount: a.balance, currency: a.currency as 'XAF' | 'USD' | 'EUR' }}
                    className="text-sm font-medium"
                  />
                  <span aria-hidden="true" className="text-text-tertiary">
                    ›
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
