/**
 * Metric rows for the agent performance page. Takes a single
 * AggregateBucket and renders one row per counter.
 */
export function AgentPerformanceMetrics({
  bucket,
}: {
  bucket: {
    leadsGenerated: number;
    dealsClosed: number;
    propertiesReferred: number;
    landlordsOnboarded: number;
    tenantsOnboarded: number;
  };
}) {
  const rows = [
    { label: 'Leads', value: bucket.leadsGenerated },
    { label: 'Deals closed', value: bucket.dealsClosed },
    { label: 'Properties referred', value: bucket.propertiesReferred },
    { label: 'Landlords onboarded', value: bucket.landlordsOnboarded },
    { label: 'Tenants onboarded', value: bucket.tenantsOnboarded },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-border-default bg-surface">
      <ul className="divide-y divide-border-default">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{r.label}</span>
            <span className="amount font-medium">{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
