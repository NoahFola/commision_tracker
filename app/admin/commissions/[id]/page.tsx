import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session-server';
import { getCommission, listCommissions } from '@/services/commission.service';
import { getAgent } from '@/services/agent.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { CommissionDetail, CommissionReverseDialog } from '@/components';


export default async function CommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;

  let commission;
  try {
    commission = await getCommission(user, id);
  } catch {
    notFound();
  }

  // The agent this commission belongs to.
  let agent;
  try {
    agent = await getAgent(user, commission.agentId);
  } catch {
    agent = null;
  }

  // If this row is a mirror, load its original. If it is an original with
  // a mirror, load the mirror. `listCommissions` returns both directions
  // if we query by customerId + period because the pair shares them.
  let pairOtherId: string | null = null;
  if (commission.reversesCommissionId) {
    pairOtherId = commission.reversesCommissionId;
  } else {
    const siblings = await listCommissions(user, {
      page: 1,
      limit: 10,
      agentId: commission.agentId,
      period: commission.period,
    });
    const mirror = siblings.items.find(
      (c) =>
        c.reversesCommissionId === commission.id && c.coreCustomerId === commission.coreCustomerId,
    );
    pairOtherId = mirror?.id ?? null;
  }

  let pairOther;
  if (pairOtherId) {
    try {
      pairOther = await getCommission(user, pairOtherId);
    } catch {
      pairOther = null;
    }
  }

  const isMirror = Boolean(commission.reversesCommissionId);
  const canReverse = commission.status !== 'PAID' && !isMirror;

  return (
    <PageShell
      title={`Commission ${shortId(commission.id)}`}
      subtitle={`${agent?.fullName ?? 'Agent'} · ${commission.coreCustomerId} · ${commission.period} · net ${commission.netAmount.amount.toLocaleString('en-US')} ${commission.netAmount.currency}`}
      action={
        <>
          {pairOther && (
            <ButtonLink href={`/admin/commissions/${pairOther.id}`} variant="secondary">
              {isMirror
                ? `Open original ${shortId(pairOther.id)}`
                : `Open mirror ${shortId(pairOther.id)}`}
            </ButtonLink>
          )}
          <CommissionReverseDialog commission={commission} disabled={!canReverse} />
        </>
      }
    >
      <CommissionDetail
        commission={commission}
        agent={agent}
        pairOther={pairOther ?? null}
        isMirror={isMirror}
      />
    </PageShell>
  );
}

function shortId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}
