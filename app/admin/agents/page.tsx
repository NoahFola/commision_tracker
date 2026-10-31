import { requireAdmin } from '@/lib/auth/session-server';
import { listAgents } from '@/services/agent.service';
import { listRegions } from '@/services/region.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { TableShell } from '@/components/ui-states/table-shell';
import { AgentTable } from '@/components/admin/agent-table';
import type { AgentStatus } from '@/components/primitives/status-badge';
import { AgentsFilterBar, Pagination } from '@/components';

const PAGE_SIZES = [5, 10, 25, 30, 50] as const;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const limitRaw = Number.parseInt(sp.limit ?? '10', 10);
  const limit = (PAGE_SIZES as readonly number[]).includes(limitRaw) ? limitRaw : 10;

  const status =
    sp.status && ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'TERMINATED'].includes(sp.status)
      ? (sp.status as AgentStatus)
      : undefined;
  const type =
    sp.type && ['AGENT', 'AMBASSADOR'].includes(sp.type)
      ? (sp.type as 'AGENT' | 'AMBASSADOR')
      : undefined;
  const regionId = sp.regionId || undefined;

  const [agentsPage, regions] = await Promise.all([
    listAgents(user, { page, limit, status, type, regionId }),
    listRegions({ isActive: true }),
  ]);

  const hasActiveFilters = Boolean(status || type || regionId);
  const isEmpty = agentsPage.items.length === 0;
  const tableState = isEmpty ? 'empty' : 'loaded';
  const emptyVariant = hasActiveFilters ? 'no-matches' : 'first-use';

  // A signature of the current filter/page state. Used as the key on
  // the table so that any change to the filters or page remounts the
  // table with a fresh selection. This is the React-recommended way
  // to reset state when props change — no useEffect.
  const tableKey = `${page}|${limit}|${status ?? ''}|${type ?? ''}|${regionId ?? ''}`;

  return (
    <PageShell
      title="Agents"
      subtitle={`${agentsPage.total} agents and ambassadors${hasActiveFilters ? ' matching' : ''}`}
      action={
        <ButtonLink href="/admin/agents/new" variant="primary">
          New agent
        </ButtonLink>
      }
    >
      <AgentsFilterBar regions={regions.map((r) => ({ id: r.id, name: r.name }))} />

      <TableShell
        state={tableState}
        emptyVariant={emptyVariant}
        emptyEntityLabel="agents"
        emptyActionLabel={hasActiveFilters ? 'Clear filters' : 'New agent'}
        emptyActionHref={hasActiveFilters ? '/admin/agents' : '/admin/agents/new'}
      >
        <AgentTable key={tableKey} agents={agentsPage.items} />
      </TableShell>

      {!isEmpty && <Pagination page={page} limit={limit} total={agentsPage.total} />}
    </PageShell>
  );
}
