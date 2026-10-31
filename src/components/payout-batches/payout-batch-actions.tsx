'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { TextInput } from '../forms/text-input';
import { useToast } from '../ui-states/toast-provider';
import type { PayoutBatchView } from '@/services/payout-batch.service';

type Action = 'APPROVE' | 'PROCESSING' | 'PAID' | 'FAILED';

/**
 * The four top-bar action buttons for a batch, gated by its current
 * status. Each opens a small confirmation dialog (mockup: batch 3,
 * images 7, 8, 4, 9). The "Mark as paid" dialog asks for a payment
 * reference when the method requires it (per Z5 in the API contract).
 */
export function PayoutBatchActions({ batch }: { batch: PayoutBatchView }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Action | null>(null);

  const show = {
    approve: batch.status === 'DRAFT',
    processing: batch.status === 'APPROVED',
    paid: batch.status === 'APPROVED' || batch.status === 'PROCESSING',
    failed: batch.status !== 'PAID' && batch.status !== 'FAILED',
  };

  const none = !show.approve && !show.processing && !show.paid && !show.failed;
  if (none) return null;

  async function run(action: Action, body?: Record<string, unknown>) {
    const path = `/api/payout-batches/${batch.id}/${pathFor(action)}`;
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json()) as
      { ok: true; data: PayoutBatchView } | { ok: false; error: { message: string } };
    if (!data.ok) throw new Error(data.error.message);
    toast.success(successMessage(action));
    setOpen(null);
    router.refresh();
  }

  return (
    <>
      {show.failed && (
        <Button variant="secondary" onClick={() => setOpen('FAILED')}>
          Mark as failed
        </Button>
      )}
      {show.processing && (
        <Button variant="secondary" onClick={() => setOpen('PROCESSING')}>
          Mark as processing
        </Button>
      )}
      {show.approve && (
        <Button variant="primary" onClick={() => setOpen('APPROVE')}>
          Approve batch
        </Button>
      )}
      {show.paid && (
        <Button variant="primary" onClick={() => setOpen('PAID')}>
          Mark as paid
        </Button>
      )}

      {/* Approve dialog */}
      <Dialog
        open={open === 'APPROVE'}
        onClose={() => setOpen(null)}
        title={`Approve batch ${shortId(batch.id)}`}
        confirmLabel="Approve batch"
        onConfirm={() => run('APPROVE')}
      >
        <p>
          Approving confirms the amount and the recipient. No money moves yet. The batch can then be
          sent for payment.
        </p>
      </Dialog>

      {/* Processing dialog */}
      <Dialog
        open={open === 'PROCESSING'}
        onClose={() => setOpen(null)}
        title={`Mark batch ${shortId(batch.id)} as processing`}
        confirmLabel="Mark as processing"
        onConfirm={() => run('PROCESSING')}
      >
        <p>
          Do this once you have started the transfer. The batch stays in Processing until you mark
          it as paid or failed.
        </p>
      </Dialog>

      {/* Paid dialog */}
      <PaidDialog
        batch={batch}
        open={open === 'PAID'}
        onClose={() => setOpen(null)}
        onSubmit={(ref) => run('PAID', ref)}
      />

      {/* Failed dialog */}
      <FailedDialog
        batch={batch}
        open={open === 'FAILED'}
        onClose={() => setOpen(null)}
        onSubmit={(reason) => run('FAILED', { reason })}
      />
    </>
  );
}

function PaidDialog({
  batch,
  open,
  onClose,
  onSubmit,
}: {
  batch: PayoutBatchView;
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { paymentReference?: string }) => Promise<void>;
}) {
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresRef = batch.method !== 'CASH';
  const canSubmit = !busy && (!requiresRef || ref.trim().length > 0);

  async function confirm() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(requiresRef ? { paymentReference: ref.trim() } : {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setRef('');
        setError(null);
      }}
      title={`Mark batch ${shortId(batch.id)} as paid`}
      confirmLabel="Mark as paid"
      confirmDisabled={!canSubmit}
      onConfirm={confirm}
    >
      <p>
        This marks the commissions as Paid and shows the payment to the agent with this reference.
        It cannot be undone.
      </p>
      {requiresRef && (
        <div className="mt-3">
          <TextInput
            name="paymentReference"
            label={`Payment reference (required for ${methodLabel(batch.method)})`}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            disabled={busy}
            helper="The transaction ID from the confirmation message."
          />
        </div>
      )}
      {error && (
        <p className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-xs text-danger-fg">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function FailedDialog({
  batch,
  open,
  onClose,
  onSubmit,
}: {
  batch: PayoutBatchView;
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !busy && reason.trim().length > 0;

  async function confirm() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setReason('');
        setError(null);
      }}
      title={`Mark batch ${shortId(batch.id)} as failed`}
      confirmLabel="Mark as failed"
      destructive
      confirmDisabled={!canSubmit}
      onConfirm={confirm}
    >
      <p>
        The batch stays as a permanent record and cannot be reopened. Its{' '}
        {batch.commissionIds.length} commission{batch.commissionIds.length === 1 ? '' : 's'}{' '}
        {batch.commissionIds.length === 1 ? 'is' : 'are'} released and can go into a new batch.
      </p>
      <div className="mt-3">
        <TextInput
          name="reason"
          label="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
          helper="Shown on the batch and in the agent profile."
        />
      </div>
      {error && (
        <p className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-xs text-danger-fg">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function pathFor(action: Action): string {
  switch (action) {
    case 'APPROVE':
      return 'approve';
    case 'PROCESSING':
      return 'processing';
    case 'PAID':
      return 'paid';
    case 'FAILED':
      return 'fail';
  }
}

function successMessage(action: Action): string {
  switch (action) {
    case 'APPROVE':
      return 'Batch approved';
    case 'PROCESSING':
      return 'Batch marked as processing';
    case 'PAID':
      return 'Batch marked as paid';
    case 'FAILED':
      return 'Batch marked as failed';
  }
}

function shortId(id: string): string {
  return `PB-${id.slice(-4).toUpperCase()}`;
}

function methodLabel(method: string): string {
  if (method === 'MOBILE_MONEY') return 'mobile money';
  if (method === 'BANK') return 'bank transfer';
  return 'cash';
}
