import { requireAdmin } from '@/lib/auth/session-server';
import { listRegions } from '@/services/region.service';
import { PageShell } from '@/components/layout/page-shell';
import { AgentForm } from '@/components';

export default async function NewAgentPage() {
  await requireAdmin();
  const regions = await listRegions({ isActive: true });

  return (
    <PageShell
      title="New agent"
      subtitle="Creates the agent record and the sign-in account in one step."
    >
      <AgentForm mode="create" regions={regions.map((r) => ({ id: r.id, name: r.name }))} />
    </PageShell>
  );
}
