'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { CurrencyAmount } from '../primitives/currency-amount';
import { TextInput } from '../forms/text-input';
import { useToast } from '../ui-states/toast-provider';
import type { CommissionView } from '@/services/commission.service';

/**
 * The Reverse commission dialog. Requires a reason and a typed
 * confirmation of the commission ID. On success, redirects to the
 * mirror's detail page so the admin can verify and approve it.
 *
 * If `disabled` is true (PAID commission, or the commission is itself
 * a mirror), the trigger is disabled and no dialog can open.
 */
export function CommissionReverseDialog({
  commission,
  disabled = false,
}: {
  commission: CommissionView;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shortCode = `CM-${commission.id.slice(-6).toUpperCase()}`;
  const canSubmit = reason.trim().length > 0 && typed === shortCode && !submitting;

  async function confirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/commissions/${commission.id}/reverse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = (await res.json()) as
        | { ok: true; data: CommissionView }
        | { ok: false; error: { code: string; message: string } };

      if (!data.ok) {
        setError(data.error.message);
        setSubmitting(false);
        return;
      }

      toast.success('Reversal created', 'The mirror is Pending; verify and approve it.');
      setOpen(false);
      router.push(`/admin/commissions/${data.data.id}`);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  if (disabled) {
    return (
      <Button variant="secondary" disabled>
        Reverse
      </Button>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Reverse
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setReason('');
          setTyped('');
          setError(null);
        }}
        title={`Reverse commission ${shortCode}`}
        confirmLabel="Reverse commission"
        destructive
        onConfirm={confirm}
      >
        <dl className="space-y-2 rounded border border-border-default bg-surface-muted p-3 text-sm">
          <Row label="Agent" value={commission.agentId.slice(-6).toUpperCase()} />
          <Row label="Customer" value={commission.coreCustomerId} />
          <Row label="Period" value={commission.period} />
          <Row label="Net amount">
            <CurrencyAmount value={commission.netAmount} />
          </Row>
        </dl>

        <p className="mt-3">
          This creates a mirror commission of −{commission.netAmount.amount.toLocaleString('en-US')}{' '}
          {commission.netAmount.currency} for the same customer and period. The original row stays
          unchanged. This cannot be undone.
        </p>

        <div className="mt-3">
          <TextInput
            name="reason"
            label="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="mt-3">
          <TextInput
            name="confirm"
            label={`Type ${shortCode} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
          />
        </div>

        {error && (
          <p className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-xs text-danger-fg">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right font-medium">{children ?? value}</dd>
    </div>
  );
}
