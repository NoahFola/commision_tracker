import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';
import { DateTime } from '../primitives/date-time';
import type { CommissionView } from '@/services/commission.service';
import type { PayoutBatchView } from '@/services/payout-batch.service';

type Row = {
  at: string;
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  href: string;
};

/**
 * Recent activity across commissions and batches. Not the audit log;
 * derived from the two entities' own `updatedAt` timestamps. The
 * label reflects the current status, not the historical event:
 *   - a PENDING commission -> "Commission <id> created"
 *   - a VERIFIED commission -> "Commission <id> verified"
 *   - an APPROVED commission -> "Commission <id> approved"
 *   - a PAID commission -> "Commission <id> paid"
 *   - a batch -> "Batch <id> created as Draft" / "marked Processing"
 *     / "marked Failed" / "marked Paid"
 *
 * This is honest to what the data records today. When the audit log
 * is exposed via a "recent" endpoint, the panel can switch to reading
 * that instead, with the true event names.
 */
export function DashboardRecentActivity({
  commissions,
  batches,
  agentsById,
}: {
  commissions: CommissionView[];
  batches: PayoutBatchView[];
  agentsById: Record<string, string>;
}) {
  const rows: Row[] = [];

  for (const c of commissions) {
    const at = c.updatedAt;
    const agentName = agentsById[c.agentId] ?? 'Agent';
    rows.push({
      at,
      title: `Commission ${shortCommissionId(c.id)} ${commissionEventLabel(c.status)}`,
      subtitle: `${agentName} · ${c.coreCustomerId}`,
      amount: c.netAmount.amount,
      currency: c.netAmount.currency,
      href: `/admin/commissions/${c.id}`,
    });
  }

  for (const b of batches) {
    const at = b.updatedAt;
    const agentName = agentsById[b.agentId] ?? 'Agent';
    rows.push({
      at,
      title: `Batch ${shortBatchId(b.id)} ${batchEventLabel(b.status)}`,
      subtitle: `${agentName} · ${b.period}`,
      amount: b.totalAmount.amount,
      currency: b.totalAmount.currency,
      href: `/admin/payout-batches/${b.id}`,
    });
  }

  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const top = rows.slice(0, 8);

  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent activity</h2>
        <Link
          href="/admin/commissions"
          className="focus-ring rounded text-xs text-text-secondary underline-offset-2 hover:underline"
        >
          Open ledger
        </Link>
      </header>

      {top.length === 0 ? (
        <p className="py-4 text-sm text-text-secondary">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border-default">
          {top.map((r, i) => (
            <li key={`${r.href}-${i}`} className="py-3">
              <Link href={r.href} className="focus-ring block rounded">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span className="whitespace-nowrap text-xs text-text-tertiary">
                    <DateTime value={r.at} variant="datetime" />
                  </span>
                </p>
                <p className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-text-secondary">
                  <span>{r.subtitle}</span>
                  {r.amount !== undefined && r.currency && (
                    <CurrencyAmount
                      value={{ amount: r.amount, currency: r.currency as 'XAF' | 'USD' | 'EUR' }}
                      className="text-xs"
                    />
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function commissionEventLabel(status: CommissionView['status']): string {
  switch (status) {
    case 'PENDING':
      return 'created';
    case 'VERIFIED':
      return 'verified';
    case 'APPROVED':
      return 'approved';
    case 'PAID':
      return 'paid';
  }
}

function batchEventLabel(status: PayoutBatchView['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'created as Draft';
    case 'APPROVED':
      return 'approved';
    case 'PROCESSING':
      return 'moved to Processing';
    case 'PAID':
      return 'marked Paid';
    case 'FAILED':
      return 'marked Failed';
  }
}

function shortCommissionId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}

function shortBatchId(id: string): string {
  return `PB-${id.slice(-4).toUpperCase()}`;
}
