import { CopyButton } from '../primitives/copy-button';
import { CurrencyAmount } from '../primitives/currency-amount';
import type { PayoutBatchView } from '@/services/payout-batch.service';

/**
 * One payout row in the agent's mobile list.
 * Paid batches show the payment reference with a Copy button.
 */
export function AgentPayoutListItem({ batch }: { batch: PayoutBatchView }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {batch.status === 'PAID' && batch.paidAt
              ? `Paid on ${formatShortDate(batch.paidAt)}`
              : batch.status === 'PROCESSING'
                ? 'Being prepared'
                : batch.status === 'FAILED'
                  ? 'Did not go through'
                  : batch.status === 'APPROVED'
                    ? 'Approved, awaiting send'
                    : 'Draft'}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">{methodLine(batch)}</p>
        </div>
        <span className="text-sm font-medium">
          <CurrencyAmount value={batch.totalAmount} />
        </span>
      </div>
      {batch.paymentReference && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded border border-border-subtle bg-surface-muted px-2 py-1 text-xs">
          <span className="font-mono">ref {batch.paymentReference}</span>
          <CopyButton value={batch.paymentReference} variant="text" />
        </div>
      )}
      <p className="mt-2 text-xs text-text-secondary">
        {batch.commissionIds.length} commission{batch.commissionIds.length === 1 ? '' : 's'}
        {batch.status === 'PAID' ? ' · all paid' : ''}
      </p>
    </div>
  );
}

function methodLine(batch: PayoutBatchView): string {
  const label =
    batch.method === 'MOBILE_MONEY'
      ? 'MTN MoMo / Orange Money'
      : batch.method === 'BANK'
        ? 'Bank transfer'
        : 'Cash';
  return label;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${shifted.getUTCDate()} ${months[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}`;
}
