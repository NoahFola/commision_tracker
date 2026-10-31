import type { CommissionView } from '@/services/commission.service';
import type { PayoutBatchView } from '@/services/payout-batch.service';
import type { AgentDetail } from '@/types/agent';
import Link from 'next/link';
import { CopyButton } from '../primitives/copy-button';
import { CurrencyAmount } from '../primitives/currency-amount';
import { PayoutBatchRemoveDialog } from './payout-batch-remove-dialog';
import { PayoutBatchTimeline } from './payout-batch-timeline';

export function PayoutBatchDetail({
  batch,
  agent,
  commissions,
}: {
  batch: PayoutBatchView;
  agent: AgentDetail | null;
  commissions: CommissionView[];
}) {
  // Running total: as we walk the commissions in their original order,
  // accumulate netAmount.amount. The server doesn't guarantee an order,
  // so we sort by createdAt ascending for a stable display.
  const sorted = [...commissions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const withRunning: { commission: CommissionView; running: number }[] = [];
  let running = 0;
  for (const c of sorted) {
    running += c.netAmount.amount;
    withRunning.push({ commission: c, running });
  }

  const isFailed = batch.status === 'FAILED';
  const isEditable = batch.status === 'DRAFT';

  return (
    <div className="space-y-6">
      {/* Top banner — status-specific */}
      {isFailed && (
        <div className="rounded border border-danger-fg bg-danger-bg px-4 py-4 text-sm text-danger-fg">
          <p className="font-medium">This payout did not go through</p>
          <p className="mt-1">
            Failed on {formatDate(batch.failedAt)} WAT, marked by{' '}
            {batch.paidBy ? shortUser(batch.paidBy) : '—'}. Reason: {batch.failureReason ?? '—'}
          </p>
          <p className="mt-1">
            {agent?.fullName ?? 'The agent'} is still owed {formatAmount(batch.totalAmount.amount)}{' '}
            XAF. The {commissions.length} commission{commissions.length === 1 ? '' : 's'}{' '}
            {commissions.length === 1 ? 'is' : 'are'} released and this batch stays as a record. To
            pay the agent, create a new batch.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/admin/payout-batches/new?agentId=${batch.agentId}&period=${batch.period}`}
              className="focus-ring inline-flex items-center justify-center rounded bg-btn-primary-bg px-3 py-1.5 text-sm font-medium text-btn-primary-fg hover:bg-btn-primary-bg-hover"
            >
              Create new batch for {agent?.fullName ?? 'agent'}
            </Link>
            <Link
              href={`/admin/commissions?agentId=${batch.agentId}&period=${batch.period}&status=APPROVED`}
              className="focus-ring inline-flex items-center justify-center rounded border border-btn-secondary-border bg-btn-secondary-bg px-3 py-1.5 text-sm font-medium text-btn-secondary-fg hover:bg-btn-secondary-bg-hover"
            >
              View released commissions
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          {commissions.length > 0 ? (
            <section className="overflow-hidden rounded border border-border-default bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Commission
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Customer
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Period
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
                    <th scope="col" className="px-3 py-2 text-right">
                      Running total
                    </th>
                    {isEditable && (
                      <th scope="col" className="w-16 px-3 py-2" aria-label="Actions" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {withRunning.map(({ commission: c, running }) => (
                    <tr key={c.id} className="border-t border-border-default">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/admin/commissions/${c.id}`}
                          className="focus-ring rounded font-mono text-xs hover:underline"
                        >
                          {shortCommissionId(c.id)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{c.coreCustomerId}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{c.period}</td>
                      <td className="px-3 py-2 text-right">
                        <CurrencyAmount value={c.grossAmount} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CurrencyAmount value={c.platformFee} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CurrencyAmount value={c.netAmount} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        <CurrencyAmount
                          value={{ amount: running, currency: c.netAmount.currency }}
                        />
                      </td>
                      {isEditable && (
                        <td className="px-3 py-2 text-right">
                          <PayoutBatchRemoveDialog batch={batch} commission={c} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border-default bg-surface-muted text-sm">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 font-medium">
                      Batch total · {commissions.length} commission
                      {commissions.length === 1 ? '' : 's'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CurrencyAmount
                        value={{ amount: sum(commissions, 'grossAmount'), currency: 'XAF' }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CurrencyAmount
                        value={{ amount: sum(commissions, 'platformFee'), currency: 'XAF' }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <CurrencyAmount value={batch.totalAmount} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <CurrencyAmount value={batch.totalAmount} />
                    </td>
                    {isEditable && <td />}
                  </tr>
                </tfoot>
              </table>
            </section>
          ) : (
            <div className="rounded border border-border-default bg-surface px-6 py-12 text-center text-sm text-text-secondary">
              No commissions are currently attached to this batch.
            </div>
          )}

          {/* Success banners — status-specific */}
          {batch.status === 'DRAFT' && (
            <div className="rounded border border-info-fg/30 bg-info-bg px-4 py-3 text-sm text-info-fg">
              <p className="font-medium">Add a commission</p>
              <p className="mt-1">
                No other APPROVED commissions for {agent?.fullName ?? 'this agent'} in{' '}
                {batch.period}. Approved commissions were added when the batch was created.
              </p>
            </div>
          )}

          {batch.status === 'APPROVED' && (
            <div className="rounded border border-success-fg/30 bg-success-bg px-4 py-3 text-sm text-success-fg">
              Batch total {formatAmount(batch.totalAmount.amount)} XAF equals the sum of the net
              amounts and is above the 5,000 XAF minimum.
            </div>
          )}

          <PayoutBatchTimeline batch={batch} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <section className="rounded border border-border-default bg-surface p-5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              TOTAL TO PAY
            </h2>
            <p className="mt-1 text-2xl font-semibold">
              <CurrencyAmount value={batch.totalAmount} />
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Agent">{agent?.fullName ?? '—'}</Row>
              <Row label="Period">{batch.period}</Row>
              <Row label="Method">{methodLabel(batch.method)}</Row>
              {agent?.payoutPreference.accountNumber && (
                <Row label="Account number">
                  <span className="font-mono text-xs">{agent.payoutPreference.accountNumber}</span>
                </Row>
              )}
              {agent?.payoutPreference.accountName && (
                <Row label="Account name">{agent.payoutPreference.accountName}</Row>
              )}
              <Row label="Payment reference">
                {batch.paymentReference ? (
                  <span className="flex items-center gap-1 font-mono text-xs">
                    {batch.paymentReference}
                    <CopyButton value={batch.paymentReference} variant="icon" />
                  </span>
                ) : (
                  <span className="text-text-tertiary">Not entered yet</span>
                )}
              </Row>
            </dl>
          </section>

          {batch.status === 'DRAFT' && (
            <section className="rounded border border-border-default bg-surface-muted p-5 text-sm">
              <h2 className="text-base font-semibold">Steps to payment</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-text-secondary">
                <li>Approve the batch.</li>
                <li>Send the transfer and mark the batch as processing.</li>
                <li>Mark it as paid with the payment reference, or as failed with the reason.</li>
              </ol>
            </section>
          )}

          {(batch.status === 'APPROVED' || batch.status === 'PROCESSING') && (
            <section className="rounded border border-border-default bg-surface-muted p-5 text-sm">
              <h2 className="text-base font-semibold">If the transfer does not go through</h2>
              <p className="mt-2 text-text-secondary">
                Mark the batch as failed and give the reason. The batch stays as a record, its
                commissions are released, and you create a new batch for them.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function sum(items: CommissionView[], field: 'grossAmount' | 'platformFee' | 'netAmount'): number {
  return items.reduce((s, c) => s + c[field].amount, 0);
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
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
  const day = shifted.getUTCDate();
  const month = months[shifted.getUTCMonth()];
  const year = shifted.getUTCFullYear();
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hh}:${mm}`;
}

function shortCommissionId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}

function shortUser(id: string): string {
  return id.slice(-6).toUpperCase();
}

function methodLabel(method: string): string {
  if (method === 'MOBILE_MONEY') return 'Mobile money';
  if (method === 'BANK') return 'Bank transfer';
  return 'Cash';
}
