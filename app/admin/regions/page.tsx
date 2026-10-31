import { requireAdmin } from '@/lib/auth/session-server';
import { listRegions } from '@/services/region.service';
import { PageShell } from '@/components/layout/page-shell';
import { RegionCreateForm } from '@/components/regions/region-create-form';
import { RegionsTable } from '@/components';

export default async function RegionsPage() {
  await requireAdmin();

  const all = await listRegions({});
  const active = all.filter((r) => r.isActive);
  const inactive = all.filter((r) => !r.isActive);

  return (
    <PageShell
      title="Regions"
      subtitle={`${active.length} active${inactive.length > 0 ? ` · ${inactive.length} inactive` : ''}`}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <RegionsTable regions={all} />
        <RegionCreateForm />
      </div>
    </PageShell>
  );
}
