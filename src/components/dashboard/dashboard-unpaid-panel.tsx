import { CurrencyAmount } from '../primitives/currency-amount';
import { CommissionStatusBadge } from '../primitives/status-badge';
import { ButtonLink } from '../primitives/button';
import type { CommissionStatusSummary } from '@/services/report.service';

export function DashboardUnpaidPanel({ summary }: { summary: CommissionStatusSummary }) {
  const total =
    summary.PENDING.total.amount + summary.VERIFIED.total.amount + summary.APPROVED.total.amount;
  const count = summary.PENDING.count + summary.VERIFIED.count + summary.APPROVED.count;

  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          Unpaid commissions awaiting action
        </p>
        <p className="mt-1 text-3xl font-semibold amount">
          <CurrencyAmount value={{ amount: total, currency: summary.PENDING.total.currency }} />
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {count} commission{count === 1 ? '' : 's'} · net of platform fee
        </p>
      </header>

      <ul className="mt-5 divide-y divide-border-default">
        <Row
          label="Pending"
          status="PENDING"
          count={summary.PENDING.count}
          amount={summary.PENDING.total}
          actionLabel="Open verify queue"
          href="/admin/commissions?status=PENDING"
          caption="To verify"
        />
        <Row
          label="Verified"
          status="VERIFIED"
          count={summary.VERIFIED.count}
          amount={summary.VERIFIED.total}
          actionLabel="Open approve queue"
          href="/admin/commissions?status=VERIFIED"
          caption="To approve"
        />
        <Row
          label="Approved, not yet paid"
          status="APPROVED"
          count={summary.APPROVED.count}
          amount={summary.APPROVED.total}
          actionLabel="Open approved"
          href="/admin/commissions?status=APPROVED"
          caption="Approved, awaiting payout"
        />
      </ul>
    </section>
  );
}

function Row({
  status,
  count,
  amount,
  actionLabel,
  href,
  caption,
}: {
  label: string;
  status: 'PENDING' | 'VERIFIED' | 'APPROVED';
  count: number;
  amount: { amount: number; currency: 'XAF' | 'USD' | 'EUR' };
  actionLabel: string;
  href: string;
  caption: string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <CommissionStatusBadge status={status} />
        <div>
          <p className="text-sm font-medium">
            {caption} · {count} commission{count === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <CurrencyAmount value={amount} className="text-sm font-medium" />
        <ButtonLink href={href} variant="secondary" size="small">
          {actionLabel}
        </ButtonLink>
      </div>
    </li>
  );
}
