import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session-server';
import { getBatch } from '@/services/payout-batch.service';
import { getAgent } from '@/services/agent.service';
import { listCommissions } from '@/services/commission.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { PayoutBatchActions, PayoutBatchDetail } from '@/components';


export default async function PayoutBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;

  let batch;
  try {
    batch = await getBatch(user, id);
  } catch {
    notFound();
  }

  let agent;
  try {
    agent = await getAgent(user, batch.agentId);
  } catch {
    agent = null;
  }

  // Load the commission rows in this batch. `listCommissions` returns
  // commissions for the agent+period; we filter to the batch's set.
  const allForAgent = await listCommissions(user, {
    page: 1,
    limit: 50,
    agentId: batch.agentId,
    period: batch.period,
  });
  const includedIdSet = new Set(batch.commissionIds);
  const commissions = allForAgent.items.filter((c) => includedIdSet.has(c.id));

  return (
    <PageShell
      title={`Batch ${shortId(batch.id)}`}
      subtitle={`${agent?.fullName ?? 'Agent'} · ${batch.period} · ${methodLabel(batch.method)}`}
      action={
        <>
          <ButtonLink href={`/admin/agents/${batch.agentId}`} variant="secondary">
            Open agent
          </ButtonLink>
          <PayoutBatchActions batch={batch} />
        </>
      }
    >
      <PayoutBatchDetail batch={batch} agent={agent} commissions={commissions} />
    </PageShell>
  );
}

function shortId(id: string): string {
  return `PB-${id.slice(-4).toUpperCase()}`;
}

function methodLabel(method: string): string {
  if (method === 'MOBILE_MONEY') return 'MTN MoMo / Orange Money';
  if (method === 'BANK') return 'Bank transfer';
  return 'Cash';
}
