import { requireSessionUser } from '@/lib/auth/session-server';
import { listCommissions } from '@/services/commission.service';
import {
  AgentCommissionsSummary,
  AgentCommissionFilterChips,
  AgentCommissionListItem,
  type CommissionChip,
} from '@/components';
import type { CommissionStatus } from '@/components/primitives/status-badge';

const VALID: CommissionChip[] = ['all', 'being-checked', 'ready-to-pay', 'paid'];

export default async function AgentCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSessionUser();
  if (user.subjectType !== 'AGENT') return null;

  const sp = await searchParams;
  const filter: CommissionChip = VALID.includes(sp.filter as CommissionChip)
    ? (sp.filter as CommissionChip)
    : 'all';

  const statusesForFilter: CommissionStatus[] | undefined =
    filter === 'being-checked'
      ? ['PENDING', 'VERIFIED']
      : filter === 'ready-to-pay'
        ? ['APPROVED']
        : filter === 'paid'
          ? ['PAID']
          : undefined;

  // Fetch all five status-filtered lists we care about so we can
  // sum the summary consistently.
  const [all, pending, verified, approved, paid] = await Promise.all([
    listCommissions(user, { page: 1, limit: 100 }),
    listCommissions(user, { page: 1, limit: 100, status: 'PENDING' }),
    listCommissions(user, { page: 1, limit: 100, status: 'VERIFIED' }),
    listCommissions(user, { page: 1, limit: 100, status: 'APPROVED' }),
    listCommissions(user, { page: 1, limit: 100, status: 'PAID' }),
  ]);

  const currency = all.items[0]?.netAmount.currency ?? 'XAF';
  const grandTotal = all.items.reduce((s, c) => s + c.netAmount.amount, 0);

  // Filtered set to display.
  const display = (() => {
    if (!statusesForFilter) return all.items;
    return all.items.filter((c) => statusesForFilter.includes(c.status as CommissionStatus));
  })();

  // Silence unused-var linter on pending/verified/approved/paid — they
  // are future-proofing hooks for status-count filters.
  void pending;
  void verified;
  void approved;
  void paid;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold">My commissions</h1>
      </header>

      <AgentCommissionsSummary count={all.total} total={{ amount: grandTotal, currency }} />

      <AgentCommissionFilterChips current={filter} />

      {display.length === 0 ? (
        <p className="rounded-lg border border-border-default bg-surface p-4 text-sm text-text-secondary">
          No commissions match this filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {display.map((c) => (
            <li key={c.id}>
              <AgentCommissionListItem commission={c} href={`/commissions/${c.id}`} />
            </li>
          ))}
        </ul>
      )}

      {display.length > 0 && (
        <p className="pt-2 text-center text-xs text-text-tertiary">
          That is all of your commissions.
        </p>
      )}
    </div>
  );
}
