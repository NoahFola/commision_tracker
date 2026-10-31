import { CurrencyAmount } from '../primitives/currency-amount';
import type { Money } from '@/lib/money';

/**
 * The secondary "Being checked" card under the hero. Shows PENDING +
 * VERIFIED commissions that are not yet approved. On the agent home,
 * this is a small pill; on Commissions, it's part of the summary.
 */
export function AgentBeingCheckedCard({
  beingChecked,
  beingCheckedCount,
}: {
  beingChecked: Money;
  beingCheckedCount: number;
}) {
  if (beingCheckedCount === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-border-default bg-surface p-4">
      <div>
        <p className="text-sm font-medium">Being checked</p>
        <p className="mt-1 text-xs text-text-secondary">
          {beingCheckedCount} commission{beingCheckedCount === 1 ? '' : 's'}. It
          {beingCheckedCount === 1 ? ' is' : ' is'} added to what you are owed once approved.
        </p>
      </div>
      <span className="text-sm font-medium">
        <CurrencyAmount value={beingChecked} />
      </span>
    </div>
  );
}