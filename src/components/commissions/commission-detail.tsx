import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';
import { DateTime } from '../primitives/date-time';
import type { CommissionView } from '@/services/commission.service';
import type { AgentDetail } from '@/types/agent';
import { CommissionReversalPair } from './commission-reversal-pair';
import { CommissionTimeline } from './commission-timeline';
import { CopyButton } from '../primitives/copy-button';
import { CommissionActionsByStatus } from './commission-actions-by-status';

export function CommissionDetail({
  commission,
  agent,
  pairOther,
  isMirror,
}: {
  commission: CommissionView;
  agent: AgentDetail | null;
  pairOther: CommissionView | null;
  isMirror: boolean;
}) {
  const platformFeePct = (commission.platformFeeRateApplied / 100).toFixed(2);
  const ratePct = (commission.rateApplied / 100).toFixed(2);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {/* Reversed banner, only when the commission is a mirror or has been reversed */}
        {pairOther && (
          <div className="rounded border border-warning-fg/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg">
            {isMirror ? (
              <>
                This is a reversal mirror. It undoes{' '}
                <Link
                  href={`/admin/commissions/${pairOther.id}`}
                  className="focus-ring rounded underline underline-offset-2"
                >
                  {pairOther.id.slice(-6).toUpperCase()}
                </Link>
                . Once verified and approved, the pair nets to zero.
              </>
            ) : (
              <>
                Reversed on <DateTime value={commission.updatedAt} variant="date" />. This
                commission stays Approved and unchanged. It is held out of payout batches while its
                mirror{' '}
                <Link
                  href={`/admin/commissions/${pairOther.id}`}
                  className="focus-ring rounded underline underline-offset-2"
                >
                  {pairOther.id.slice(-6).toUpperCase()}
                </Link>{' '}
                is waiting to be verified.
              </>
            )}
          </div>
        )}

        {/* How the amount is worked out */}
        <section className="rounded border border-border-default bg-surface p-5">
          <h2 className="text-base font-semibold">How the amount is worked out</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Base amount · the customer's first payment">
              <CurrencyAmount value={commission.baseAmount} />
            </Row>
            <Row label="Rate applied">
              <span className="amount">{ratePct}%</span>
            </Row>
            <Row label="Gross commission">
              <CurrencyAmount value={commission.grossAmount} />
            </Row>
            <Row label={`Platform fee · ${platformFeePct}% of gross`}>
              <span className="amount text-text-secondary">
                −<CurrencyAmount value={commission.platformFee} />
              </span>
            </Row>
            <div className="mt-3 flex items-baseline justify-between border-t border-border-default pt-3">
              <dt className="font-medium text-text-primary">Net to agent</dt>
              <dd>
                <CurrencyAmount
                  value={commission.netAmount}
                  className="text-lg font-semibold"
                  signed
                />
              </dd>
            </div>
          </dl>
        </section>

        {/* Reversal pair (only if there is a mirror or we are a mirror) */}
        {pairOther && (
          <CommissionReversalPair
            current={commission}
            other={pairOther}
            isCurrentMirror={isMirror}
          />
        )}

        {/* Timeline */}
        <CommissionTimeline commission={commission} pairOther={pairOther} />
      </div>

      <div className="space-y-4">
        <section className="rounded border border-border-default bg-surface p-5">
          <h2 className="text-base font-semibold">Agent</h2>
          {agent ? (
            <>
              <p className="mt-2 font-medium">{agent.fullName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {agent.type === 'AGENT' ? 'Agent' : 'Ambassador'} · {agent.region.name}
              </p>
              <p className="mt-1 text-xs text-text-secondary">{agent.phone}</p>
              <p className="mt-3">
                <Link
                  href={`/admin/agents/${agent.id}`}
                  className="focus-ring rounded text-sm underline-offset-2 hover:underline"
                >
                  Open agent
                </Link>
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-tertiary">Agent record not available.</p>
          )}
        </section>

        <section className="rounded border border-border-default bg-surface p-5">
          <h2 className="text-base font-semibold">Customer</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-text-secondary">Customer ID</dt>
              <dd className="flex items-center gap-1 font-mono text-xs">
                {commission.coreCustomerId}
                <CopyButton value={commission.coreCustomerId} variant="icon" />
              </dd>
            </div>
            <Row label="Period">
              <span className="font-mono text-xs">{commission.period}</span>
            </Row>
            <Row label="First payment">
              <DateTime value={commission.firstPaymentConfirmedAt} variant="datetime" />
            </Row>
          </dl>
        </section>

        <section className="rounded border border-border-default bg-surface p-5">
          <h2 className="text-base font-semibold">Payout</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <Row label="Payout batch">
              {commission.payoutBatchId ? (
                <span className="font-mono text-xs">
                  {commission.payoutBatchId.slice(-6).toUpperCase()}
                </span>
              ) : (
                <span className="text-text-secondary">Not in a batch</span>
              )}
            </Row>
          </dl>
          {pairOther && !commission.payoutBatchId && (
            <p className="mt-3 text-xs text-text-tertiary">
              If the mirror is approved, the two cancel out and nothing is paid for this customer.
            </p>
          )}
        </section>

        <CommissionActionsByStatus commission={commission} />
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
