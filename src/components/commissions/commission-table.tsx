import Link from 'next/link';
import { CommissionStatusBadge, ReversalBadge } from '../primitives/status-badge';
import { CurrencyAmount } from '../primitives/currency-amount';
import { DateTime } from '../primitives/date-time';
import { CommissionRowActions } from './commission-row-actions';
import type { CommissionView } from '@/services/commission.service';

/**
 * Read-only table of commissions.
 *
 * Used in two places:
 *   - The agent detail's Commissions tab (showAgentColumn=false,
 *     showActions=false).
 *   - The main /admin/commissions ledger (showAgentColumn=true,
 *     showActions=true).
 *
 * Kept as one component so the two views stay in sync visually.
 */
export function CommissionTable({
  items,
  agentNames,
  showAgentColumn = false,
  showActions = false,
}: {
  items: CommissionView[];
  /** Map agentId -> display name. Required when showAgentColumn is true. */
  agentNames?: Record<string, { name: string; type: 'AGENT' | 'AMBASSADOR' }>;
  showAgentColumn?: boolean;
  showActions?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded border border-border-default bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2">
              Commission
            </th>
            {showAgentColumn && (
              <th scope="col" className="px-3 py-2">
                Agent
              </th>
            )}
            <th scope="col" className="px-3 py-2">
              Customer
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Gross
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Platform fee
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Net
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
            <th scope="col" className="px-3 py-2">
              Verified by
            </th>
            <th scope="col" className="px-3 py-2">
              Approved by
            </th>
            <th scope="col" className="px-3 py-2">
              Paid at
            </th>
            {showActions && <th scope="col" className="w-8 px-3 py-2" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const agent = agentNames?.[c.agentId];
            return (
              <tr key={c.id} className="border-t border-border-default hover:bg-surface-muted">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    href={`/admin/commissions/${c.id}`}
                    className="focus-ring rounded font-mono text-xs hover:underline"
                  >
                    {shortId(c.id)}
                  </Link>
                  <p className="text-xs text-text-tertiary">{c.period}</p>
                </td>
                {showAgentColumn && (
                  <td className="px-3 py-2">
                    <p className="font-medium">{agent?.name ?? '—'}</p>
                    <p className="text-xs text-text-tertiary">
                      {agent?.type === 'AGENT'
                        ? 'Agent'
                        : agent?.type === 'AMBASSADOR'
                          ? 'Ambassador'
                          : ''}
                    </p>
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                  {c.coreCustomerId}
                </td>
                <td className="px-3 py-2 text-right">
                  <CurrencyAmount value={c.grossAmount} />
                </td>
                <td className="px-3 py-2 text-right">
                  <CurrencyAmount value={c.platformFee} />
                </td>
                <td className="px-3 py-2 text-right">
                  <CurrencyAmount value={c.netAmount} signed />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.reversesCommissionId && <ReversalBadge />}
                    <CommissionStatusBadge status={c.status} />
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {c.verifiedAt ? <DateTime value={c.verifiedAt} variant="datetime" /> : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {c.approvedAt ? <DateTime value={c.approvedAt} variant="datetime" /> : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {c.paidAt ? <DateTime value={c.paidAt} variant="datetime" /> : '—'}
                </td>
                {showActions && (
                  <td className="px-3 py-2 text-right">
                    <CommissionRowActions commission={c} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-text-secondary">
          No commissions match.
        </div>
      )}
    </div>
  );
}

function shortId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}
