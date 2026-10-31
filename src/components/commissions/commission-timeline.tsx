import { DateTime } from '../primitives/date-time';
import type { CommissionView } from '@/services/commission.service';

/**
 * Vertical timeline of a commission's lifecycle. Each step is either
 * done (with a filled dot and the timestamp), pending (empty dot), or
 * not reachable because of a reversal.
 */
export function CommissionTimeline({
  commission,
  pairOther,
}: {
  commission: CommissionView;
  pairOther: CommissionView | null;
}) {
  const reversed = Boolean(pairOther) && !commission.reversesCommissionId;

  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <h2 className="text-base font-semibold">Timeline</h2>
      <ol className="mt-4 space-y-4">
        <Step label="Created as Pending" at={commission.createdAt} done />
        <Step label="Verified" at={commission.verifiedAt} done={Boolean(commission.verifiedAt)} />
        <Step label="Approved" at={commission.approvedAt} done={Boolean(commission.approvedAt)} />
        {reversed && (
          <Step
            label={`Reversed · mirror ${pairOther ? shortId(pairOther.id) : ''} created`}
            at={commission.updatedAt}
            done
            destructive
          />
        )}
        <Step
          label="Paid"
          at={commission.paidAt}
          done={Boolean(commission.paidAt)}
          muted={
            reversed && !commission.paidAt
              ? 'Not paid. Held while the reversal is pending.'
              : !commission.paidAt
                ? 'Not paid yet.'
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

function shortId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}
