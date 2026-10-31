import { requireAdmin } from '@/lib/auth/session-server';
import { listAgents } from '@/services/agent.service';
import { PageShell } from '@/components/layout/page-shell';
import { CommissionForm } from '@/components/commissions/commission-form';

/**
 * New commission page. Admin-only (the parent layout enforces it, and
 * requireAdmin() is here for type narrowing).
 *
 * Loads the active agents list (page 1, limit 100 — same cap as the
 * ledger filter) so the form can populate the agent select. The form
 * itself does all the input handling and submission.
 */
export default async function NewCommissionPage() {
  const user = await requireAdmin();

  const agentsPage = await listAgents(user, { page: 1, limit: 100, status: 'ACTIVE' });

  return (
    <PageShell
      title="New commission"
      subtitle="Records a commission for a signed customer whose first subscription payment has been confirmed."
    >
      <CommissionForm
        agents={agentsPage.items.map((a) => ({
          id: a.id,
          fullName: a.fullName,
          type: a.type,
          region: a.region.name,
          commissionRate: a.commissionRate ?? 500,
        }))}
      />
    </PageShell>
  );
}
