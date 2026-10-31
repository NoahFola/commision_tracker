import Link from 'next/link';
import { BatchStatusBadge } from '../primitives/status-badge';
import { CurrencyAmount } from '../primitives/currency-amount';
import { DateTime } from '../primitives/date-time';
import type { PayoutBatchView } from '@/services/payout-batch.service';

export function PayoutBatchTable({
  items,
  agentNames,
}: {
  items: PayoutBatchView[];
  agentNames: Record<string, { name: string; type: 'AGENT' | 'AMBASSADOR' }>;
}) {
  return (
    <div className="overflow-hidden rounded border border-border-default bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2">
              Batch
            </th>
            <th scope="col" className="px-3 py-2">
              Agent
            </th>
            <th scope="col" className="px-3 py-2">
              Period
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Total amount
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
            <th scope="col" className="px-3 py-2">
              Method
            </th>
            <th scope="col" className="px-3 py-2">
              Payment reference
            </th>
            <th scope="col" className="px-3 py-2">
              Created by
            </th>
            <th scope="col" className="px-3 py-2">
              Paid at
            </th>
            <th scope="col" className="w-8 px-3 py-2" aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {items.map((b) => {
            const agent = agentNames[b.agentId];
            const isFailed = b.status === 'FAILED';
            return (
              <tr
                key={b.id}
                className={[
                  'border-t border-border-default',
                  isFailed ? 'bg-danger-bg/30 hover:bg-danger-bg/50' : 'hover:bg-surface-muted',
                ].join(' ')}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    href={`/admin/payout-batches/${b.id}`}
                    className="focus-ring rounded font-mono text-xs hover:underline"
                  >
                    {shortId(b.id)}
                  </Link>
                </td>
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
                <td className="px-3 py-2 font-mono text-xs">{b.period}</td>
                <td className="px-3 py-2 text-right">
                  <CurrencyAmount value={b.totalAmount} />
                </td>
                <td className="px-3 py-2">
                  <BatchStatusBadge status={b.status} />
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">{methodLabel(b.method)}</td>
                <td className="px-3 py-2 text-xs">
                  {b.paymentReference ? (
                    <span className="font-mono">{b.paymentReference}</span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {b.createdBy.slice(-6).toUpperCase()}
                  <br />
                  <span className="text-text-tertiary">
                    <DateTime value={b.createdAt} variant="datetime" />
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {b.paidAt ? <DateTime value={b.paidAt} variant="datetime" /> : '—'}
                </td>
                <td className="px-3 py-2 text-right text-text-tertiary" aria-hidden="true">
                  ›
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-text-secondary">
          No payout batches match.
        </div>
      )}
    </div>
  );
}

function methodLabel(method: PayoutBatchView['method']): string {
  if (method === 'MOBILE_MONEY') return 'MTN MoMo / Orange Money';
  if (method === 'BANK') return 'Bank transfer';
  return 'Cash';
}

function shortId(id: string): string {
  return `PB-${id.slice(-4).toUpperCase()}`;
}
