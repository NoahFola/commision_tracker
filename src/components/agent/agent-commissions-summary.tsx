import { CurrencyAmount } from '../primitives/currency-amount';
import type { Money } from '@/lib/money';

/**
 * Summary header for the agent commissions page: count + total.
 */
export function AgentCommissionsSummary({ count, total }: { count: number; total: Money }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface p-4">
      <p className="text-sm text-text-secondary">
        {count} commission{count === 1 ? '' : 's'}
      </p>
      <p className="mt-1 text-2xl font-semibold">
        <CurrencyAmount value={total} />
      </p>
    </section>
  );
}
