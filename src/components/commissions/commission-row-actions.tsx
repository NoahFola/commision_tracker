'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { TextInput } from '../forms/text-input';
import { useToast } from '../ui-states/toast-provider';
import type { CommissionView } from '@/services/commission.service';

/**
 * The `…` menu in a commission row. Renders the correct action(s) for
 * the row's status:
 *   PENDING   -> Verify
 *   VERIFIED  -> Approve
 *   APPROVED  -> (none)
 *   PAID      -> (none)
 *   Reversal  -> Verify (approve the mirror)
 *
 * Reverse is available from the commission detail page, not from the
 * list, because it needs a reason and the typed-id confirmation.
 */
export function CommissionRowActions({ commission }: { commission: CommissionView }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const action: 'VERIFY' | 'APPROVE' | null =
    commission.status === 'PENDING'
      ? 'VERIFY'
      : commission.status === 'VERIFIED'
        ? 'APPROVE'
        : null;

  if (!action) return null;

  async function confirm() {
    setBusy(true);
    try {
      const path =
        action === 'VERIFY'
          ? `/api/commissions/${commission.id}/verify`
          : `/api/commissions/${commission.id}/approve`;
      const res = await fetch(path, { method: 'POST' });
      const body = (await res.json()) as { ok: true } | { ok: false; error: { message: string } };
      if (!body.ok) throw new Error(body.error.message);
      toast.success(action === 'VERIFY' ? 'Commission verified' : 'Commission approved');
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        {action === 'VERIFY' ? 'Verify' : 'Approve'}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={action === 'VERIFY' ? 'Verify commission' : 'Approve commission'}
        confirmLabel={action === 'VERIFY' ? 'Verify' : 'Approve'}
        onConfirm={confirm}
        confirmDisabled={busy}
      >
        <p>
          {action === 'VERIFY'
            ? 'This moves the commission to Verified and records who did it and when.'
            : 'This moves the commission to Approved. It can then go into a payout batch.'}
        </p>
      </Dialog>
    </>
  );
}
