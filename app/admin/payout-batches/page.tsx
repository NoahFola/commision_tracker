import { requireAdmin } from '@/lib/auth/session-server';
import { listBatches } from '@/services/payout-batch.service';
import { listAgents } from '@/services/agent.service';
import { loadBatchSummary } from '@/services/report.service';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { PayoutBatchStatusTiles } from '@/components/payout-batches/payout-batch-status-tiles';
import { PayoutBatchesFilterBar } from '@/components/payout-batches/payout-batches-filter-bar';
import { PayoutBatchTable } from '@/components/payout-batches/payout-batch-table';
import { Pagination } from '@/components/ui-states/pagination';
import type { PayoutBatchStatus } from '@/models/payout-batch.model';

const PAGE_SIZES = [5, 10, 25, 30, 50] as const;

export default async function PayoutBatchesPage({
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
    sp.status && ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED'].includes(sp.status)
      ? (sp.status as PayoutBatchStatus)
      : undefined;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : undefined;
  const agentId = sp.agentId || undefined;

  const [batchesPage, summary, agentsResult] = await Promise.all([
    listBatches(user, { page, limit, status, period, agentId }),
    loadBatchSummary(user, period ?? null),
    listAgents(user, { page: 1, limit: 100 }),
  ]);

  const agentNames: Record<string, { name: string; type: 'AGENT' | 'AMBASSADOR' }> = {};
  for (const a of agentsResult.items) {
    agentNames[a.id] = { name: a.fullName, type: a.type };
  }

  return (
    <PageShell
      title="Payout batches"
      subtitle={`${batchesPage.total} batch${batchesPage.total === 1 ? '' : 'es'} · minimum 5,000 XAF per batch`}
      action={
        <>
          <ButtonLink href="/api/reports/payouts.csv" variant="secondary">
            Export payouts (CSV)
          </ButtonLink>
          <ButtonLink href="/admin/payout-batches/new" variant="primary">
            New batch
          </ButtonLink>
        </>
      }
    >
      <PayoutBatchStatusTiles tiles={summary.buckets} />

      <PayoutBatchesFilterBar
        agents={agentsResult.items.map((a) => ({ id: a.id, name: a.fullName }))}
      />

      <PayoutBatchTable items={batchesPage.items} agentNames={agentNames} />

      {batchesPage.total > 0 && <Pagination page={page} limit={limit} total={batchesPage.total} />}
    </PageShell>
  );
}
