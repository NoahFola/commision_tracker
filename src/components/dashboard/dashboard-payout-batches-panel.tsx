import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';
import { BatchStatusBadge } from '../primitives/status-badge';
import { ButtonLink } from '../primitives/button';
import type { PayoutBatchView } from '@/services/payout-batch.service';

export function DashboardPayoutBatchesPanel({ batches }: { batches: PayoutBatchView[] }) {
  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Payout batches</h2>
        <Link
          href="/admin/payout-batches"
          className="focus-ring rounded text-xs text-text-secondary underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </header>

      {batches.length === 0 ? (
        <p className="py-4 text-sm text-text-secondary">No batches yet.</p>
      ) : (
        <ul className="divide-y divide-border-default">
          {batches.map((b) => (
            <li key={b.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <Link
                    href={`/admin/payout-batches/${b.id}`}
                    className="focus-ring rounded font-mono text-xs hover:underline"
                  >
                    {shortId(b.id)}
                  </Link>
                  <BatchStatusBadge status={b.status} />
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">{b.period}</p>
                {b.status === 'FAILED' && b.failureReason && (
                  <p className="mt-1 text-xs text-danger-fg">Failed. Reason: {b.failureReason}</p>
                )}
              </div>
              <CurrencyAmount value={b.totalAmount} className="text-sm font-medium" />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <ButtonLink href="/admin/payout-batches/new" variant="secondary" size="small">
          New batch
        </ButtonLink>
      </div>
    </section>
  );
}

function shortId(id: string): string {
  return `PB-${id.slice(-4).toUpperCase()}`;
}
