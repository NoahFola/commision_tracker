import { requireAdmin } from '@/lib/auth/session-server';
import { listAgents } from '@/services/agent.service';
import { PageShell } from '@/components/layout/page-shell';
import { PayoutBatchForm } from '@/components/payout-batches/payout-batch-form';

/**
 * New payout batch page. Admin-only. Loads the active agents list
 * (page 1, limit 100, same cap as everywhere else) so the form can
 * populate the agent picker. The form fetches the selected agent's
 * detail, commissions, and existing batches itself on selection.
 */
export default async function NewPayoutBatchPage() {
  const user = await requireAdmin();

  const agentsPage = await listAgents(user, { page: 1, limit: 100, status: 'ACTIVE' });

  return (
    <PageShell
      title="New payout batch"
      subtitle="Groups every eligible APPROVED commission for one agent and one period into a single batch."
    >
      <PayoutBatchForm
        agents={agentsPage.items.map((a) => ({
          id: a.id,
          fullName: a.fullName,
          type: a.type,
          region: a.region.name,
        }))}
      />
    </PageShell>
  );
}
