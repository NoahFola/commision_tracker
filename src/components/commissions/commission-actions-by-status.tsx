'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { useToast } from '../ui-states/toast-provider';
import type { CommissionView } from '@/services/commission.service';

/**
 * The "What you can do next" card shown in the detail sidebar. Lists
 * the available actions for the commission's current status.
 *
 * PAID is terminal for reversal (client-side). Reverse is only shown
 * for PENDING, VERIFIED, APPROVED originals.
 */
export function CommissionActionsByStatus({ commission }: { commission: CommissionView }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'VERIFY' | 'APPROVE' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMirror = Boolean(commission.reversesCommissionId);
  const next: 'VERIFY' | 'APPROVE' | null =
    commission.status === 'PENDING'
      ? 'VERIFY'
      : commission.status === 'VERIFIED'
        ? 'APPROVE'
        : null;

  async function doTransition() {
    if (!confirm) return;
    setSubmitting(true);
    setError(null);
    try {
      const path =
        confirm === 'VERIFY'
          ? `/api/commissions/${commission.id}/verify`
          : `/api/commissions/${commission.id}/approve`;
      const res = await fetch(path, { method: 'POST' });
      const data = (await res.json()) as { ok: true } | { ok: false; error: { message: string } };
      if (!data.ok) {
        setError(data.error.message);
        setSubmitting(false);
        return;
      }
      toast.success(confirm === 'VERIFY' ? 'Commission verified' : 'Commission approved');
      setConfirm(null);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  if (!next) {
    return (
      <section className="rounded border border-border-default bg-surface-muted p-5">
        <h2 className="text-sm font-semibold">What you can do next</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {commission.status === 'PAID'
            ? 'This commission is paid. It is complete.'
            : isMirror
              ? 'This mirror is in a terminal state.'
              : 'No actions available for this commission.'}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <h2 className="text-sm font-semibold">What you can do next</h2>
      <p className="mt-2 text-sm text-text-secondary">
        {next === 'VERIFY'
          ? 'Verify this commission to move it to Verified.'
          : 'Approve this commission to move it to Approved. It can then go into a payout batch.'}
      </p>
      <div className="mt-3">
        <Button variant="primary" onClick={() => setConfirm(next)}>
          {next === 'VERIFY' ? 'Verify' : 'Approve'}
        </Button>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
          setError(null);
        }}
        title={next === 'VERIFY' ? 'Verify commission' : 'Approve commission'}
        confirmLabel={next === 'VERIFY' ? 'Verify' : 'Approve'}
        onConfirm={doTransition}
        confirmDisabled={submitting}
      >
        <p>
          {next === 'VERIFY'
            ? 'This moves the commission to Verified and records who did it and when.'
            : 'This moves the commission to Approved. It can then go into a payout batch.'}
        </p>
        {error && <p className="mt-3 text-xs text-danger-fg">{error}</p>}
      </Dialog>
    </section>
  );
}
