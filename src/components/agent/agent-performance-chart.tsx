import { PerformanceChart } from '../performance-chart';
import type { AggregateBucket } from '@/services/performance.service';

/**
 * "Deals closed · last 6 months" mini bar chart for the agent
 * performance page. Reuses the shared PerformanceChart.
 */
export function AgentPerformanceChart({ buckets }: { buckets: AggregateBucket[] }) {
  const data = buckets.map((b) => ({
    periodKey: shortMonth(b.periodKey),
    value: b.dealsClosed,
  }));

  return (
    <section className="rounded-lg border border-border-default bg-surface p-5">
      <h2 className="text-sm font-medium">Deals closed · last 6 months</h2>
      <div className="mt-3">
        <PerformanceChart data={data} format="count" />
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        These figures are recorded by the EpsiHome team. If one looks wrong, tell your EpsiHome
        contact the month and the number.
      </p>
    </section>
  );
}

function shortMonth(periodKey: string): string {
  // '2026-09' -> 'Sep'
  const [y, m] = periodKey.split('-');
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}
