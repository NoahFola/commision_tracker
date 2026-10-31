import { CurrencyAmount } from '../primitives/currency-amount';
import type { Money } from '@/lib/money';

/**
 * The big "Revenue you brought in" card at the top of the agent
 * performance page.
 */
export function AgentPerformanceHero({ revenue }: { revenue: Money }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface p-5">
      <p className="text-sm text-text-secondary">Revenue you brought in</p>
      <p className="mt-1 text-3xl font-semibold">
        <CurrencyAmount value={revenue} />
      </p>
    </section>
  );
}
