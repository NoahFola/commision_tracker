'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { CurrencyAmount } from '../primitives/currency-amount';
import { useToast } from '../ui-states/toast-provider';
import type { PayoutBatchView } from '@/services/payout-batch.service';
import type { CommissionView } from '@/services/commission.service';

const MINIMUM_BATCH_AMOUNT_XAF = 5000;

/**
 * Confirms removing one commission from a DRAFT batch. Shows the
 * current total and what the total would be after removal; if the
 * resulting total would fall below the 5,000 XAF minimum, an amber
 * warning explains that the batch would no longer be approvable.
 *
 * Removal succeeds regardless of the warning — the API allows a DRAFT
 * to fall below the minimum (the check runs again at approval, per
 * the payout-batch service). The dialog is informative, not blocking.
 */
export function PayoutBatchRemoveDialog({
  batch,
  commission,
}: {
  batch: PayoutBatchView;
  commission: CommissionView;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = batch.totalAmount.amount;
  const after = current - commission.netAmount.amount;
  const belowMinimum = after < MINIMUM_BATCH_AMOUNT_XAF;
  const shortCode = `CM-${commission.id.slice(-6).toUpperCase()}`;

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/payout-batches/${batch.id}/commissions/${commission.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as
        { ok: true; data: PayoutBatchView } | { ok: false; error: { message: string } };
      if (!data.ok) {
        setError(data.error.message);
        setSubmitting(false);
        return;
      }
      toast.success('Commission removed from batch');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring rounded text-xs text-danger-fg underline-offset-2 hover:underline"
      >
        Remove
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title={`Remove ${shortCode} from batch ${`PB-${batch.id.slice(-4).toUpperCase()}`}`}
        confirmLabel="Remove commission"
        destructive
        confirmDisabled={submitting}
        onConfirm={confirm}
      >
        <dl className="space-y-2 rounded border border-border-default bg-surface-muted p-3 text-sm">
          <Row label="Commission">
            <span className="font-mono text-xs">
              {shortCode} · {commission.coreCustomerId}
            </span>
          </Row>
          <Row label="Net amount">
            <CurrencyAmount value={commission.netAmount} />
          </Row>
          <Row label="Batch total now">
            <CurrencyAmount value={batch.totalAmount} />
          </Row>
          <Row label="Batch total after">
            <span className={belowMinimum ? 'font-medium text-danger-fg' : 'font-medium'}>
              <CurrencyAmount value={{ amount: after, currency: batch.totalAmount.currency }} />
            </span>
          </Row>
        </dl>

        {belowMinimum && (
          <div className="mt-3 rounded border border-warning-fg/30 bg-warning-bg px-3 py-2 text-xs text-warning-fg">
            The batch would fall to {after.toLocaleString('en-US')} XAF, below the 5,000 XAF
            minimum, and could not be approved. The commission stays Approved and can go into
            another batch.
          </div>
        )}

        {error && (
          <p className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-xs text-danger-fg">
            {error}
          </p>
        )}
      </Dialog>
    </>
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
