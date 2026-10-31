import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';
import { CommissionStatusBadge, ReversalBadge } from '../primitives/status-badge';
import { DateTime } from '../primitives/date-time';
import type { CommissionView } from '@/services/commission.service';

/**
 * Renders the two commissions in a reversal pair side by side, plus
 * the net effect and (if present) the reversal reason and actor.
 *
 * The "current" and "other" are passed explicitly; this component
 * doesn't try to figure out which is which. On the detail page,
 * `current` is the one whose URL was loaded; `other` is the pair.
 */
export function CommissionReversalPair({
  current,
  other,
  isCurrentMirror,
}: {
  current: CommissionView;
  other: CommissionView;
  isCurrentMirror: boolean;
}) {
  const original = isCurrentMirror ? other : current;
  const mirror = isCurrentMirror ? current : other;

  const netEffect = original.netAmount.amount + mirror.netAmount.amount;
  const currency = original.netAmount.currency;

  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-base font-semibold">Reversal pair</span>
      </header>

      <div className="space-y-2 text-sm">
        <PairRow
          id={original.id}
          label="Original · this commission"
          status={original.status}
          amount={original.netAmount}
          isMirror={false}
        />
        <PairRow
          id={mirror.id}
          label="Mirror · created by the reversal"
          status={mirror.status}
          amount={mirror.netAmount}
          isMirror
        />
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-border-default pt-3 text-sm">
        <span className="text-text-secondary">Net effect of the pair</span>
        <CurrencyAmount value={{ amount: netEffect, currency }} className="font-medium" />
      </div>

      {mirror.reason && (
        <p className="mt-3 text-xs text-text-secondary">
          Reason: {mirror.reason}. Reversed by {mirror.createdBy.slice(-6).toUpperCase()} on{' '}
          <DateTime value={mirror.createdAt} variant="datetime" />.
        </p>
      )}
    </section>
  );
}

function PairRow({
  id,
  label,
  status,
  amount,
  isMirror,
}: {
  id: string;
  label: string;
  status: CommissionView['status'];
  amount: CommissionView['netAmount'];
  isMirror: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/admin/commissions/${id}`}
          className="focus-ring rounded font-mono text-xs hover:underline"
        >
          {shortId(id)}
        </Link>
        <span className="truncate text-xs text-text-secondary">{label}</span>
        {isMirror && <ReversalBadge />}
        <CommissionStatusBadge status={status} />
      </div>
      <CurrencyAmount value={amount} signed />
    </div>
  );
}

function shortId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}
