'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { Dialog } from '../ui-states/dialog';
import { useToast } from '../ui-states/toast-provider';
import type { AgentDetail } from '@/types/agent';

/**
 * Two-way status toggle. If the agent is ACTIVE, offers Suspend. If
 * SUSPENDED, offers Reactivate. Calls PATCH with the appropriate
 * status.
 */
export function AgentSuspendDialog({ agent }: { agent: AgentDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const isSuspended = agent.status === 'SUSPENDED';
  const nextStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';

  async function confirm() {
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = (await res.json()) as
      | { ok: true; data: AgentDetail }
      | { ok: false; error: { code: string; message: string } };
    if (!body.ok) {
      throw new Error(body.error.message);
    }
    toast.success(isSuspended ? 'Agent reactivated' : 'Agent suspended');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant={isSuspended ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
        {isSuspended ? 'Reactivate' : 'Suspend'}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isSuspended ? `Reactivate ${agent.fullName}` : `Suspend ${agent.fullName}`}
        confirmLabel={isSuspended ? 'Reactivate' : 'Suspend'}
        destructive={!isSuspended}
        onConfirm={confirm}
      >
        <p>
          {isSuspended
            ? `${agent.fullName} will be able to sign in again. Commissions and payouts are unaffected.`
            : `${agent.fullName} will not be able to sign in while suspended. Commissions, payouts and history stay as they are. You can set the status back to Active at any time.`}
        </p>
      </Dialog>
    </>
  );
}