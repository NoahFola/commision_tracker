'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { CurrencyAmount } from '../primitives/currency-amount';
import { useToast } from '../ui-states/toast-provider';
import type { AgentDetail } from '@/types/agent';

/**
 * Terminate confirmation. Requires typing the agent's name. Calls
 * PATCH /api/agents/[id] with { status: 'TERMINATED' }.
 *
 * If the API returns 409 (unpaid commissions), the dialog shows the
 * block message inline and stays open.
 */
export function AgentTerminateDialog({ agent }: { agent: AgentDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function confirm() {
    setServerError(null);
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'TERMINATED' }),
    });
    const body = (await res.json()) as
      | { ok: true; data: AgentDetail }
      | { ok: false; error: { code: string; message: string } };

    if (!body.ok) {
      throw new Error(body.error.message);
    }

    toast.success('Agent terminated');
    setOpen(false);
    router.push('/admin/agents');
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Terminate agent
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setServerError(null);
        }}
        title={`Terminate ${agent.fullName}`}
        confirmLabel="Terminate agent"
        destructive
        confirmToken={agent.fullName}
        onConfirm={confirm}
      >
        <div className="rounded border border-border-default bg-surface-muted p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-text-secondary">Status now</span>
            <span className="font-medium">{agent.status}</span>
          </div>
        </div>
        <p className="mt-3">
          This sets the status to Terminated. {agent.fullName} will no
          longer be able to sign in. Commissions, payouts and audit
          history are kept. This cannot be undone.
        </p>
        {serverError && (
          <p className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-sm text-danger-fg">
            {serverError}
          </p>
        )}
      </Dialog>
    </>
  );
}