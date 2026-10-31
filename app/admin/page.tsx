import { requireAdmin } from '@/lib/auth/session-server';
import { listCommissions, getUnpaidBalance } from '@/services/commission.service';
import { listBatches } from '@/services/payout-batch.service';
import { listAgents } from '@/services/agent.service';
import { loadCommissionStatusSummary } from '@/services/report.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { DashboardUnpaidPanel } from '@/components/dashboard/dashboard-unpaid-panel';
import { DashboardPayoutBatchesPanel } from '@/components/dashboard/dashboard-payout-batches-panel';
import { DashboardRecentActivity } from '@/components/dashboard/dashboard-recent-activity';
import { DashboardAgentsAttention } from '@/components/dashboard/dashboard-agents-attention';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();

  // Data for the panels. All four fetches run in parallel.
  const [statusSummary, recentBatches, recentCommissions, agents] = await Promise.all([
    loadCommissionStatusSummary(user, { period: null, agentId: null }),
    listBatches(user, { page: 1, limit: 5 }),
    listCommissions(user, { page: 1, limit: 5 }),
    listAgents(user, { page: 1, limit: 100, status: 'ACTIVE' }),
  ]);

  // "Agents needing attention" — agents with an unpaid balance.
  // Balance is not on the list item, so we compute per-agent. We do a
  // second pass over the returned agents to fetch their balance; the
  // underlying getUnpaidBalance aggregates all unpaid rows for the
  // agent (PENDING + VERIFIED + APPROVED).
  const attentionRows = await Promise.all(
    agents.items.map(async (a) => {
      const balance = await getUnpaidBalance(a.id);
      return {
        id: a.id,
        fullName: a.fullName,
        region: a.region.name,
        balance: balance.total,
        currency: balance.currency ?? 'XAF',
        count: balance.count,
      };
    }),
  );
  const attention = attentionRows
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return (
    <PageShell
      title="Dashboard"
      subtitle="What needs doing today."
      action={
        <>
          <ButtonLink href="/admin/agents/new" variant="secondary">
            New agent
          </ButtonLink>
          <ButtonLink href="/admin/commissions/new" variant="primary">
            New commission
          </ButtonLink>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <DashboardUnpaidPanel summary={statusSummary} />
          <DashboardRecentActivity
            commissions={recentCommissions.items}
            batches={recentBatches.items}
            agentsById={Object.fromEntries(agents.items.map((a) => [a.id, a.fullName]))}
          />
        </div>
        <div className="space-y-6">
          <DashboardPayoutBatchesPanel batches={recentBatches.items} />
          <DashboardAgentsAttention agents={attention} />
        </div>
      </div>
    </PageShell>
  );
}
