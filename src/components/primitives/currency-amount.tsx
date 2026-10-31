import { formatAmountOnly } from '@/lib/money/format';
import type { Money } from '@/lib/money/money';

/**
 * Renders a Money value as an aligned, tabular-figure amount.
 *
 * The number is one step louder than the currency code, matching the
 * design: `15,675 XAF` where XAF is dimmer.
 *
 * `signed` (default false): when true, negative amounts render in red.
 * When false, the caller controls colour — useful when the surrounding
 * context already conveys meaning (e.g. a reversal pair).
 */

export function CurrencyAmount({
  value,
  signed = false,
  className = '',
}: {
  value: Money;
  signed?: boolean;
  className?: string;
}) {
  const isNegative = value.amount < 0;
  const colour = signed && isNegative ? 'text-danger-fg' : '';
  return (
    <span className={['amount whitespace-nowrap', colour, className].filter(Boolean).join(' ')}>
      <span>{formatAmountOnly(value)}</span>{' '}
      <span className="text-text-tertiary">{value.currency}</span>
    </span>
  );
}
