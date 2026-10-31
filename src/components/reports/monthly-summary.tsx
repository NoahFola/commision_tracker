import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';
import type { SummaryResult, SummaryRow, SummaryAmounts } from '@/services/report.service';

type GroupBy = 'agent' | 'region';

export function MonthlySummary({
  summary,
  groupBy,
  mode,
}: {
  summary: SummaryResult;
  groupBy: GroupBy;
  mode: 'screen' | 'print';
}) {
  const rows: AggregatedRow[] =
    groupBy === 'agent' ? summary.rows : aggregateByRegion(summary.rows);

  return (
    <div className={mode === 'print' ? 'text-xs' : ''}>
      {mode === 'screen' && <FilterBar summary={summary} groupBy={groupBy} />}

      <section
        className={
          mode === 'print'
            ? 'mt-4'
            : 'mt-4 overflow-hidden rounded border border-border-default bg-surface'
        }
      >
        <table className="w-full">
          <thead
            className={
              mode === 'print'
                ? 'bg-white text-black'
                : 'bg-surface-muted text-left text-xs font-medium text-text-secondary'
            }
          >
            <tr>
              <th scope="col" rowSpan={2} className="px-3 py-2 align-bottom">
                {groupBy === 'agent' ? 'Agent' : 'Region'}
              </th>
              {groupBy === 'region' && (
                <th scope="col" rowSpan={2} className="px-3 py-2 align-bottom text-right">
                  Agents
                </th>
              )}
              <th
                scope="col"
                colSpan={4}
                className="px-3 py-2 text-center border-b border-border-default"
              >
                Commissions
              </th>
              <th
                scope="col"
                colSpan={4}
                className="px-3 py-2 text-center border-b border-border-default"
              >
                Net amount
              </th>
            </tr>
            <tr>
              <th scope="col" className="px-2 py-1 text-right">
                Pending
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Verified
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Approved
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Paid
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Pending + verified
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Approved
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Paid
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r, groupBy)} className="border-t border-border-default">
                <td className="px-3 py-2">
                  {groupBy === 'agent' ? (
                    mode === 'screen' ? (
                      <Link
                        href={`/admin/agents/${r.agentId}`}
                        className="focus-ring rounded font-medium hover:underline"
                      >
                        {r.agentName}
                        <span className="block text-xs font-normal text-text-tertiary">
                          {r.agentType === 'AGENT' ? 'Agent' : 'Ambassador'}
                        </span>
                      </Link>
                    ) : (
                      <>
                        {r.agentName}
                        <span className="block text-[10px] text-gray-600">
                          {r.agentType === 'AGENT' ? 'Agent' : 'Ambassador'}
                        </span>
                      </>
                    )
                  ) : (
                    <span className="font-medium">{r.agentName}</span>
                  )}
                </td>
                {groupBy === 'region' && (
                  <td className="px-3 py-2 text-right">{r.regionAgentCount ?? ''}</td>
                )}
                <td className="amount px-2 py-2 text-right">{r.counts.pending}</td>
                <td className="amount px-2 py-2 text-right">{r.counts.verified}</td>
                <td className="amount px-2 py-2 text-right">{r.counts.approved}</td>
                <td className="amount px-2 py-2 text-right">{r.counts.paid}</td>
                <td className="px-2 py-2 text-right">
                  <CurrencyAmount value={toMoney(r.amounts.pending)} />
                </td>
                <td className="px-2 py-2 text-right">
                  <CurrencyAmount value={toMoney(r.amounts.approved)} />
                </td>
                <td className="px-2 py-2 text-right">
                  <CurrencyAmount value={toMoney(r.amounts.paid)} />
                </td>
                <td className="px-2 py-2 text-right font-medium">
                  <CurrencyAmount value={totalAmount(r)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border-default">
            <tr>
              <td className="px-3 py-3 font-semibold">
                {groupBy === 'agent' ? `Totals · all ${summary.rows.length} agents` : 'Totals'}
              </td>
              {groupBy === 'region' && (
                <td className="px-3 py-3 text-right font-semibold">{summary.rows.length}</td>
              )}
              <td className="amount px-2 py-3 text-right font-semibold">
                {summary.totals.counts.pending}
              </td>
              <td className="amount px-2 py-3 text-right font-semibold">
                {summary.totals.counts.verified}
              </td>
              <td className="amount px-2 py-3 text-right font-semibold">
                {summary.totals.counts.approved}
              </td>
              <td className="amount px-2 py-3 text-right font-semibold">
                {summary.totals.counts.paid}
              </td>
              <td className="px-2 py-3 text-right font-semibold">
                <CurrencyAmount value={toMoney(summary.totals.amounts.pending)} />
              </td>
              <td className="px-2 py-3 text-right font-semibold">
                <CurrencyAmount value={toMoney(summary.totals.amounts.approved)} />
              </td>
              <td className="px-2 py-3 text-right font-semibold">
                <CurrencyAmount value={toMoney(summary.totals.amounts.paid)} />
              </td>
              <td className="px-2 py-3 text-right font-semibold">
                <CurrencyAmount value={totalsAmount(summary.totals.amounts)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p
        className={`mt-3 ${mode === 'print' ? 'text-[10px] text-gray-600' : 'text-xs text-text-tertiary'}`}
      >
        Verified money is counted in the Pending bucket. Every download is recorded in the audit log
        with the filters used.
      </p>
    </div>
  );
}

function FilterBar({ summary, groupBy }: { summary: SummaryResult; groupBy: GroupBy }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/admin/reports?period=${summary.period}&groupBy=agent&includeEmpty=${summary.includeEmpty}`}
        className={[
          'focus-ring rounded border border-border-default px-3 py-1.5 text-sm',
          groupBy === 'agent'
            ? 'bg-success-bg font-medium text-success-fg'
            : 'hover:bg-surface-muted',
        ].join(' ')}
      >
        By agent
      </Link>
      <Link
        href={`/admin/reports?period=${summary.period}&groupBy=region&includeEmpty=${summary.includeEmpty}`}
        className={[
          'focus-ring rounded border border-border-default px-3 py-1.5 text-sm',
          groupBy === 'region'
            ? 'bg-success-bg font-medium text-success-fg'
            : 'hover:bg-surface-muted',
        ].join(' ')}
      >
        By region
      </Link>
      <span className="ml-auto text-xs text-text-tertiary">
        Showing {summary.rows.length} {groupBy === 'agent' ? 'agents' : 'regions'}
      </span>
    </div>
  );
}

// ---- helpers ----

type AggregatedRow = SummaryRow & {
  regionAgentCount?: number;
};

function aggregateByRegion(rows: SummaryRow[]): AggregatedRow[] {
  const byRegion = new Map<string, AggregatedRow>();
  for (const r of rows) {
    const key = r.region?.name ?? 'Unknown';
    const existing = byRegion.get(key);
    if (!existing) {
      byRegion.set(key, {
        agentId: key,
        agentName: key,
        agentType: 'AGENT',
        region: r.region,
        counts: { ...r.counts },
        amounts: {
          pending: { ...r.amounts.pending },
          approved: { ...r.amounts.approved },
          paid: { ...r.amounts.paid },
        },
        regionAgentCount: 1,
      });
    } else {
      existing.counts.pending += r.counts.pending;
      existing.counts.verified += r.counts.verified;
      existing.counts.approved += r.counts.approved;
      existing.counts.paid += r.counts.paid;
      existing.amounts.pending.gross += r.amounts.pending.gross;
      existing.amounts.pending.platformFee += r.amounts.pending.platformFee;
      existing.amounts.pending.net += r.amounts.pending.net;
      existing.amounts.approved.gross += r.amounts.approved.gross;
      existing.amounts.approved.platformFee += r.amounts.approved.platformFee;
      existing.amounts.approved.net += r.amounts.approved.net;
      existing.amounts.paid.gross += r.amounts.paid.gross;
      existing.amounts.paid.platformFee += r.amounts.paid.platformFee;
      existing.amounts.paid.net += r.amounts.paid.net;
      existing.regionAgentCount = (existing.regionAgentCount ?? 0) + 1;
    }
  }
  return Array.from(byRegion.values()).sort((a, b) => a.agentName.localeCompare(b.agentName));
}

function toMoney(amounts: SummaryAmounts) {
  return {
    amount: amounts.net,
    currency: amounts.currency as 'XAF' | 'USD' | 'EUR',
  };
}

function totalAmount(r: SummaryRow) {
  return {
    amount: r.amounts.pending.net + r.amounts.approved.net + r.amounts.paid.net,
    currency: r.amounts.pending.currency as 'XAF' | 'USD' | 'EUR',
  };
}

function totalsAmount(amounts: SummaryResult['totals']['amounts']) {
  return {
    amount: amounts.pending.net + amounts.approved.net + amounts.paid.net,
    currency: amounts.pending.currency as 'XAF' | 'USD' | 'EUR',
  };
}

function rowKey(r: SummaryRow, groupBy: GroupBy): string {
  return groupBy === 'agent' ? r.agentId : (r.region?.name ?? 'unknown');
}
