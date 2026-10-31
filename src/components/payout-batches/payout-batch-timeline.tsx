import { DateTime } from '../primitives/date-time';
import type { PayoutBatchView } from '@/services/payout-batch.service';

export function PayoutBatchTimeline({ batch }: { batch: PayoutBatchView }) {
  const reversed = false; // batches are not reversed
  const failed = batch.status === 'FAILED';

  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <h2 className="text-base font-semibold">Timeline</h2>
      <ol className="mt-4 space-y-4">
        <Step label="Created as Draft" at={batch.createdAt} done />
        <Step
          label="Approved"
          at={batch.approvedAt}
          done={Boolean(batch.approvedAt)}
          muted={
            !batch.approvedAt
              ? 'Not approved yet. Approval checks the 5,000 XAF minimum again.'
              : undefined
          }
        />
        <Step
          label="Processing"
          at={batch.paidAt ?? null}
          done={batch.status === 'PROCESSING' || batch.status === 'PAID' || failed}
          muted={
            batch.status === 'DRAFT' || batch.status === 'APPROVED'
              ? 'Starts when the transfer is sent.'
              : undefined
          }
        />
        <Step
          label={failed ? 'Failed' : 'Paid'}
          at={failed ? batch.failedAt : batch.paidAt}
          done={failed || Boolean(batch.paidAt)}
          destructive={failed}
          muted={
            failed
              ? `Reason: ${batch.failureReason ?? '—'}`
              : !batch.paidAt
                ? 'Not paid yet. Marking as paid needs the payment reference.'
                : undefined
          }
        />
      </ol>
    </section>
  );
}

function Step({
  label,
  at,
  done,
  destructive = false,
  muted,
}: {
  label: string;
  at: string | null;
  done: boolean;
  destructive?: boolean;
  muted?: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={[
          'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
          done
            ? destructive
              ? 'bg-danger-fg'
              : 'bg-btn-primary-bg'
            : 'border border-border-default bg-surface',
        ].join(' ')}
      />
      <div className="min-w-0">
        <p className={['text-sm font-medium', destructive ? 'text-danger-fg' : ''].join(' ')}>
          {label}
        </p>
        {done && at && (
          <p className="mt-0.5 text-xs text-text-tertiary">
            <DateTime value={at} variant="datetime" />
          </p>
        )}
        {muted && <p className="mt-0.5 text-xs text-text-tertiary">{muted}</p>}
      </div>
    </li>
  );
}
