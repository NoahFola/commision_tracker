import Link from 'next/link';
import { CommissionTable } from '../commissions/commission-table';
import { CurrencyAmount } from '../primitives/currency-amount';
import type { CommissionView } from '@/services/commission.service';

/**
 * Commissions tab. Filterable table of the agent's commissions.
 * Filters are read from the URL by the page; this component just
 * renders. The "Export this view" button links to the CSV endpoint
 * with the agent id.
 */
export function AgentCommissionsTab({
  agentId,
  items,
  total,
  showExport,
}: {
  agentId: string;
  items: CommissionView[];
  total: number;
  showExport: boolean;
}) {
  const gross = items.reduce((s, c) => s + c.grossAmount.amount, 0);
  const fee = items.reduce((s, c) => s + c.platformFee.amount, 0);
  const net = items.reduce((s, c) => s + c.netAmount.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {total} commission{total === 1 ? '' : 's'}
        </p>
        {showExport && (
          <a
            href={`/api/reports/commissions.csv?agentId=${agentId}`}
            className="focus-ring rounded border border-btn-secondary-border bg-btn-secondary-bg px-3 py-1.5 text-sm font-medium hover:bg-btn-secondary-bg-hover"
          >
            Export this view (CSV)
          </a>
        )}
      </div>

      <CommissionTable items={items} />

      {items.length > 0 && (
        <div className="flex items-center justify-end gap-4 text-sm font-medium">
          <span className="text-text-secondary">Totals ({items.length} rows)</span>
          <CurrencyAmount value={{ amount: gross, currency: 'XAF' }} />
          <CurrencyAmount value={{ amount: fee, currency: 'XAF' }} />
          <CurrencyAmount value={{ amount: net, currency: 'XAF' }} />
        </div>
      )}
    </div>
  );
}