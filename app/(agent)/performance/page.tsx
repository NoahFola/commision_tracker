import { requireSessionUser } from '@/lib/auth/session-server';
import { aggregateEvents } from '@/services/performance.service';
import {
  AgentPerformanceMonthPicker,
  AgentPerformanceHero,
  AgentPerformanceMetrics,
  AgentPerformanceChart,
} from '@/components';
import type { AggregateBucket } from '@/services/performance.service';

export default async function AgentPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSessionUser();
  if (user.subjectType !== 'AGENT') return null;

  const sp = await searchParams;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : currentWATPeriod();

  // Month bounds for the current period.
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const from = `${period}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${period}-${String(lastDay).padStart(2, '0')}`;

  // Last 6 months of data for the chart.
  const sixMonthsAgo = new Date(Date.UTC(y, m - 6, 1));
  const chartFrom = `${sixMonthsAgo.getUTCFullYear()}-${String(sixMonthsAgo.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const chartTo = to;

  const [monthData, chartData] = await Promise.all([
    aggregateEvents(user, { agentId: user.agentId, from, to, granularity: 'monthly' }),
    aggregateEvents(user, {
      agentId: user.agentId,
      from: chartFrom,
      to: chartTo,
      granularity: 'monthly',
    }),
  ]);

  const monthBucket = monthData.buckets[0];
  const currency = monthBucket?.revenueAttributed.currency ?? 'XAF';

  const emptyBucket = {
    leadsGenerated: 0,
    dealsClosed: 0,
    propertiesReferred: 0,
    landlordsOnboarded: 0,
    tenantsOnboarded: 0,
  } satisfies Partial<AggregateBucket> as Required<
    Pick<
      AggregateBucket,
      | 'leadsGenerated'
      | 'dealsClosed'
      | 'propertiesReferred'
      | 'landlordsOnboarded'
      | 'tenantsOnboarded'
    >
  >;

  const metrics = monthBucket
    ? {
        leadsGenerated: monthBucket.leadsGenerated,
        dealsClosed: monthBucket.dealsClosed,
        propertiesReferred: monthBucket.propertiesReferred,
        landlordsOnboarded: monthBucket.landlordsOnboarded,
        tenantsOnboarded: monthBucket.tenantsOnboarded,
      }
    : {
        leadsGenerated: 0,
        dealsClosed: 0,
        propertiesReferred: 0,
        landlordsOnboarded: 0,
        tenantsOnboarded: 0,
      };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">My performance</h1>
      </header>

      <AgentPerformanceMonthPicker period={period} />

      <AgentPerformanceHero
        revenue={monthBucket?.revenueAttributed ?? { amount: 0, currency: 'XAF' as const }}
      />

      <AgentPerformanceMetrics bucket={metrics} />

      <AgentPerformanceChart buckets={chartData.buckets} />
    </div>
  );
}

function currentWATPeriod(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}
