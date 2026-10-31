import dynamic from 'next/dynamic';
import { formatAmountOnly } from '@/lib/money/format';
import type { AggregateBucket } from '@/services/performance.service';

const PerformanceChart = dynamic(() => import('../performance-chart'));

const METRICS = [
  { key: 'leadsGenerated', label: 'Leads' },
  { key: 'dealsClosed', label: 'Deals closed' },
  { key: 'propertiesReferred', label: 'Properties referred' },
  { key: 'landlordsOnboarded', label: 'Landlords onboarded' },
  { key: 'tenantsOnboarded', label: 'Tenants onboarded' },
  { key: 'revenueAttributed', label: 'Revenue attributed' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

/**
 * Performance tab. Chart plus data table.
 *
 * Granularity, metric, and range all live in the URL so a filtered
 * view is shareable. The tab is a server component; only the chart
 * itself is client (Recharts).
 */
export function AgentPerformanceTab({
  buckets,
  granularity,
  metric,
}: {
  buckets: AggregateBucket[];
  granularity: 'daily' | 'weekly' | 'monthly';
  metric: MetricKey;
}) {
  const isMoney = metric === 'revenueAttributed';

  const chartData = buckets.map((b) => ({
    periodKey: b.periodKey,
    value: isMoney ? b.revenueAttributed.amount : b[metric],
  }));

  const total = chartData.reduce((s, p) => s + p.value, 0);

  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? metric;

  return (
    <div className="space-y-6">
      <section className="rounded border border-border-default bg-surface p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">
            {metricLabel} · {granularity}
          </h2>
          <p className="text-sm text-text-secondary">
            Total{' '}
            <span className="font-medium text-text-primary">
              {isMoney ? `${formatAmountOnly({ amount: total, currency: 'XAF' })} XAF` : total}
            </span>
          </p>
        </header>
        <div className="mt-4">
          <PerformanceChart data={chartData} format={isMoney ? 'money' : 'count'} />
        </div>
      </section>

      <section className="overflow-hidden rounded border border-border-default bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-2">
                Period
              </th>
              {METRICS.map((m) => (
                <th key={m.key} scope="col" className="px-3 py-2 text-right">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.periodKey} className="border-t border-border-default">
                <td className="px-3 py-2">{b.periodKey}</td>
                <td className="amount px-3 py-2 text-right">{b.leadsGenerated}</td>
                <td className="amount px-3 py-2 text-right">{b.dealsClosed}</td>
                <td className="amount px-3 py-2 text-right">{b.propertiesReferred}</td>
                <td className="amount px-3 py-2 text-right">{b.landlordsOnboarded}</td>
                <td className="amount px-3 py-2 text-right">{b.tenantsOnboarded}</td>
                <td className="amount px-3 py-2 text-right">
                  {formatAmountOnly({
                    amount: b.revenueAttributed.amount,
                    currency: b.revenueAttributed.currency as 'XAF' | 'USD' | 'EUR',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {buckets.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-text-secondary">
            No performance data in the selected range.
          </div>
        )}
      </section>
    </div>
  );
}