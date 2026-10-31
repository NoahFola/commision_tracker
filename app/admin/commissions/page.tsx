import { requireAdmin } from '@/lib/auth/session-server';
import { listCommissions } from '@/services/commission.service';
import { listAgents } from '@/services/agent.service';
import { loadCommissionStatusSummary } from '@/services/report.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { CommissionsFilterBar } from '@/components/commissions/commissions-filter-bar';
import { CommissionsExportMenu } from '@/components/commissions/commissions-export-menu';
import { CommissionStatusTiles } from '@/components/commissions/commission-status-tiles';
import { CommissionTable } from '@/components/commissions/commission-table';
import { Pagination } from '@/components/ui-states/pagination';
import type { CommissionStatus } from '@/components/primitives/status-badge';

const PAGE_SIZES = [5, 10, 25, 30, 50] as const;

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const limitRaw = Number.parseInt(sp.limit ?? '25', 10);
  const limit = (PAGE_SIZES as readonly number[]).includes(limitRaw) ? limitRaw : 25;

  const status =
    sp.status && ['PENDING', 'VERIFIED', 'APPROVED', 'PAID'].includes(sp.status)
      ? (sp.status as CommissionStatus)
      : undefined;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : undefined;
  const agentId = sp.agentId || undefined;

  const [listResult, summary, agentsResult] = await Promise.all([
    listCommissions(user, { page, limit, status, period, agentId }),
    loadCommissionStatusSummary(user, {
      period: period ?? null,
      agentId: agentId ?? null,
    }),
    listAgents(user, { page: 1, limit: 100 }),
  ]);

  const agentNames: Record<string, { name: string; type: 'AGENT' | 'AMBASSADOR' }> = {};
  for (const a of agentsResult.items) {
    agentNames[a.id] = { name: a.fullName, type: a.type };
  }

  return (
    <PageShell
      title="Commission ledger"
      subtitle={`${listResult.total} commission${listResult.total === 1 ? '' : 's'} in view`}
      action={
        <>
          <CommissionsExportMenu />
          <ButtonLink href="/admin/commissions/new" variant="primary">
            New commission
          </ButtonLink>
        </>
      }
    >
      <CommissionStatusTiles tiles={summary} />

      <CommissionsFilterBar
        agents={agentsResult.items.map((a) => ({ id: a.id, name: a.fullName }))}
      />

      <CommissionTable
        items={listResult.items}
        agentNames={agentNames}
        showAgentColumn
        showActions
      />

      {listResult.total > 0 && <Pagination page={page} limit={limit} total={listResult.total} />}
    </PageShell>
  );
}
