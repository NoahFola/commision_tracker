import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session-server';
import { getAgent, getOnboardingHistory } from '@/services/agent.service';
import { listCommissions } from '@/services/commission.service';
import { aggregateEvents } from '@/services/performance.service';
import { listAuditRows } from '@/services/audit.service';
import type { Money } from '@/lib/money/money';
import type { Currency } from '@/lib/money/currency';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/primitives/button';
import { AgentSummaryTiles } from '@/components/admin/agent-summary-tiles';
import { AgentTabs, type AgentTabKey } from '@/components/admin/agent-tabs';
import { AgentProfileTab } from '@/components/admin/agent-profile-tab';
import { AgentPerformanceTab } from '@/components/admin/agent-performance-tab';
import { AgentCommissionsTab } from '@/components/admin/agent-commissions-tab';
import { AgentAuditTab } from '@/components/admin/agent-audit-tab';
import { AgentSuspendDialog } from '@/components/admin/agent-suspend-dialog';
import { Pagination } from '@/components/ui-states/pagination';

const VALID_TABS = ['profile', 'performance', 'commissions', 'audit'] as const;
const VALID_GRANULARITIES = ['daily', 'weekly', 'monthly'] as const;
const VALID_METRICS = [
  'leadsGenerated',
  'dealsClosed',
  'propertiesReferred',
  'landlordsOnboarded',
  'tenantsOnboarded',
  'revenueAttributed',
] as const;
const AUDIT_PAGE_LIMIT = 25;

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const tab: AgentTabKey =
    sp.tab && (VALID_TABS as readonly string[]).includes(sp.tab)
      ? (sp.tab as AgentTabKey)
      : 'profile';

  let agent;
  try {
    agent = await getAgent(user, id);
  } catch {
    notFound();
  }

  // Summary tiles need commission aggregates regardless of tab.
  const [approved, pending, paid, onboarding] = await Promise.all([
    listCommissions(user, { page: 1, limit: 50, agentId: id, status: 'APPROVED' }),
    listCommissions(user, { page: 1, limit: 50, agentId: id, status: 'PENDING' }),
    listCommissions(user, { page: 1, limit: 50, agentId: id, status: 'PAID' }),
    getOnboardingHistory(user, id),
  ]);

  const lastPaid = paid.items
    .map((c) => c.paidAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop();

  const currency: Currency = approved.items[0]?.netAmount.currency as Currency | undefined ?? 'XAF';

  function sumNet(items: { netAmount: Money }[]): Money {
    if (items.length === 0) return { amount: 0, currency };
    const first = items[0]!.netAmount.currency;
    for (const i of items) {
      if (i.netAmount.currency !== first) {
        throw new Error(`Mixed currencies: ${first} and ${i.netAmount.currency}`);
      }
    }
    const amount = items.reduce((s, i) => s + i.netAmount.amount, 0);
    return { amount, currency: first as Currency };
  }

  return (
    <PageShell
      title={agent.fullName}
      subtitle={`${agent.type === 'AGENT' ? 'Agent' : 'Ambassador'} in ${agent.region.name}`}
      action={
        <>
          {agent.status !== 'TERMINATED' && <AgentSuspendDialog agent={agent} />}
          <ButtonLink href={`/admin/agents/${agent.id}/edit`} variant="secondary">
            Edit profile
          </ButtonLink>
        </>
      }
    >
      <AgentSummaryTiles
        owedNow={sumNet(approved.items)}
        owedNowCount={approved.total}
        beingChecked={sumNet(pending.items)}
        beingCheckedCount={pending.total}
        paidToDate={sumNet(paid.items)}
        paidToDateCount={paid.total}
        lastPaidAt={lastPaid ?? null}
        onboardingStage={agent.onboardingStage}
      />

      <AgentTabs current={tab} />

      {tab === 'profile' && <AgentProfileTab agent={agent} onboarding={onboarding} />}

      {tab === 'performance' && (
        <PerformanceTabSection
          user={user}
          agentId={id}
          granularityRaw={sp.granularity}
          metricRaw={sp.metric}
          fromRaw={sp.from}
          toRaw={sp.to}
        />
      )}

      {tab === 'commissions' && (
        <CommissionsTabSection user={user} agentId={id} sp={sp} />
      )}

      {tab === 'audit' && <AuditTabSection user={user} agentId={id} sp={sp} />}
    </PageShell>
  );
}

async function PerformanceTabSection({
  user,
  agentId,
  granularityRaw,
  metricRaw,
  fromRaw,
  toRaw,
}: {
  user: Awaited<ReturnType<typeof requireAdmin>>;
  agentId: string;
  granularityRaw?: string;
  metricRaw?: string;
  fromRaw?: string;
  toRaw?: string;
}) {
  const granularity =
    granularityRaw && (VALID_GRANULARITIES as readonly string[]).includes(granularityRaw)
      ? (granularityRaw as 'daily' | 'weekly' | 'monthly')
      : 'monthly';
  const metric =
    metricRaw && (VALID_METRICS as readonly string[]).includes(metricRaw)
      ? (metricRaw as (typeof VALID_METRICS)[number])
      : 'leadsGenerated';

  const from = fromRaw ?? defaultFrom();
  const to = toRaw ?? defaultTo();

  const result = await aggregateEvents(user, {
    agentId,
    granularity,
    from,
    to,
  });

  return (
    <AgentPerformanceTab buckets={result.buckets} granularity={granularity} metric={metric} />
  );
}

async function CommissionsTabSection({
  user,
  agentId,
  sp,
}: {
  user: Awaited<ReturnType<typeof requireAdmin>>;
  agentId: string;
  sp: Record<string, string | undefined>;
}) {
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const status = sp.status && ['PENDING', 'VERIFIED', 'APPROVED', 'PAID'].includes(sp.status)
    ? sp.status
    : undefined;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : undefined;

  const result = await listCommissions(user, {
    page,
    limit: 25,
    agentId,
    status,
    period,
  });

  return (
    <AgentCommissionsTab agentId={agentId} items={result.items} total={result.total} showExport />
  );
}

async function AuditTabSection({
  user,
  agentId,
  sp,
}: {
  user: Awaited<ReturnType<typeof requireAdmin>>;
  agentId: string;
  sp: Record<string, string | undefined>;
}) {
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const result = await listAuditRows(user, {
    entityType: 'Agent',
    entityId: agentId,
    page,
    limit: AUDIT_PAGE_LIMIT,
  });

  return (
    <AgentAuditTab
      rows={result.items}
      page={result.page}
      limit={result.limit}
      total={result.total}
    />
  );
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 180);
  return isoDay(d);
}

function defaultTo(): string {
  return isoDay(new Date());
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}