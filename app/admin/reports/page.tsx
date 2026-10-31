import { requireAdmin } from '@/lib/auth/session-server';
import { loadSummary } from '@/services/report.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { MonthlySummary } from '@/components/reports/monthly-summary';
import { PrintButton } from '@/components/reports/print-button';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;

  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : currentWATPeriod();
  const groupBy = sp.groupBy === 'region' ? 'region' : 'agent';
  const includeEmpty = sp.includeEmpty === 'false' ? false : true;
  const isPrint = sp.print === '1';

  const summary = await loadSummary(user, period, includeEmpty);

  // Print mode: stripped-down layout, no sidebar / no top bar.
  if (isPrint) {
    return (
      <main className="mx-auto max-w-4xl bg-white px-8 py-10 text-black">
        <header className="mb-6 flex items-baseline justify-between border-b border-black pb-3">
          <div className="flex items-baseline gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-btn-primary-bg text-xs font-semibold text-btn-primary-fg">
              E
            </span>
            <span className="font-semibold">EpsiHome Tracker</span>
          </div>
          <span className="font-semibold">Monthly summary · {formatPeriod(period)}</span>
        </header>
        <MonthlySummary summary={summary} groupBy={groupBy} mode="print" />
      </main>
    );
  }

  return (
    <PageShell
      title="Monthly summary"
      subtitle={`${formatPeriod(period)} · net amounts · exports match these figures exactly`}
      action={
        <>
          <PrintButton />
          <ButtonLink href={`/api/reports/commissions.csv?period=${period}`} variant="secondary">
            commissions.csv
          </ButtonLink>
          <ButtonLink href={`/api/reports/payouts.csv?period=${period}`} variant="secondary">
            payouts.csv
          </ButtonLink>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-4 gap-3">
        <PrintTile
          label="Pending incl. verified"
          amount={summary.totals.amounts.pending.net}
          count={summary.totals.counts.pending + summary.totals.counts.verified}
          currency={summary.totals.amounts.pending.currency}
        />
        <PrintTile
          label="Approved"
          amount={summary.totals.amounts.approved.net}
          count={summary.totals.counts.approved}
          currency={summary.totals.amounts.approved.currency}
        />
        <PrintTile
          label="Paid"
          amount={summary.totals.amounts.paid.net}
          count={summary.totals.counts.paid}
          currency={summary.totals.amounts.paid.currency}
        />
        <PrintTile
          label="Total"
          amount={
            summary.totals.amounts.pending.net +
            summary.totals.amounts.approved.net +
            summary.totals.amounts.paid.net
          }
          count={
            summary.totals.counts.pending +
            summary.totals.counts.verified +
            summary.totals.counts.approved +
            summary.totals.counts.paid
          }
          currency={summary.totals.amounts.pending.currency}
        />
      </div>
      <MonthlySummary summary={summary} groupBy={groupBy} mode="screen" />
    </PageShell>
  );
}

function currentWATPeriod(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatPeriod(p: string): string {
  const [y, m] = p.split('-');
  const monthName = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${monthName} ${y}`;
}

function PrintTile({
  label,
  amount,
  count,
  currency,
}: {
  label: string;
  amount: number;
  count: number;
  currency: string;
}) {
  return (
    <div className="rounded border border-black px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-base font-semibold">
        {amount.toLocaleString('en-US')} {currency}
      </p>
      <p className="mt-0.5 text-[10px]">
        {count} commission{count === 1 ? '' : 's'}
      </p>
    </div>
  );
}
