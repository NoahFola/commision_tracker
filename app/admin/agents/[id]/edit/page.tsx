import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session-server';
import { getAgent } from '@/services/agent.service';
import { listRegions } from '@/services/region.service';
import { PageShell } from '@/components/layout/page-shell';
import { AgentForm } from '@/components';

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;

  let agent;
  try {
    agent = await getAgent(user, id);
  } catch {
    notFound();
  }

  const activeRegions = await listRegions({ isActive: true });

  // The form only needs { id, name }. Map to that shape explicitly so
  // the type is narrow, then append the current region if it's been
  // deactivated (otherwise the select can't show the current value).
  const regionOptions: { id: string; name: string }[] = activeRegions.map((r) => ({
    id: r.id,
    name: r.name,
  }));
  if (!regionOptions.some((r) => r.id === agent.region.id)) {
    regionOptions.push({ id: agent.region.id, name: agent.region.name });
  }

  return (
    <PageShell title={`Edit ${agent.fullName}`} subtitle="Update the agent's profile.">
      <AgentForm
        mode="edit"
        agentId={agent.id}
        regions={regionOptions}
        initialValues={{
          fullName: agent.fullName,
          email: agent.email,
          phone: agent.phone,
          referralCode: agent.referralCode,
          regionId: agent.region.id,
          type: agent.type,
          status: agent.status,
          onboardingStage: agent.onboardingStage,
          payoutMethod: agent.payoutPreference.method,
          payoutProvider: agent.payoutPreference.provider ?? '',
          payoutAccountNumber: agent.payoutPreference.accountNumber ?? '',
          payoutAccountName: agent.payoutPreference.accountName ?? '',
        }}
      />
    </PageShell>
  );
}
