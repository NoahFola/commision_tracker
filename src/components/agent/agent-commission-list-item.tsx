import Link from 'next/link';
import { CommissionStatusBadge, ReversalBadge } from '../primitives/status-badge';
import { CurrencyAmount } from '../primitives/currency-amount';
import type { CommissionView } from '@/services/commission.service';

/**
 * One commission row in the agent's mobile list. Customer on the left,
 * net amount on the right, period + status underneath.
 *
 * The design's "Being checked" / "Ready to pay" labels are derived from
 * the status; the raw PENDING / VERIFIED / APPROVED / PAID enum is not
 * shown to the agent.
 */
export function AgentCommissionListItem({
  commission,
  href,
}: {
  commission: CommissionView;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border-default bg-surface p-4 hover:bg-surface-muted">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">Customer {commission.coreCustomerId}</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {formatShortDate(commission.createdAt)}
        </p>
        <div className="mt-1 flex items-center gap-1">
          {commission.reversesCommissionId && <ReversalBadge />}
          <AgentFacingStatus status={commission.status} />
        </div>
      </div>
      <span className="whitespace-nowrap text-sm font-medium">
        <CurrencyAmount value={commission.netAmount} signed />
      </span>
    </div>
  );
  return href ? (
    <Link href={href} className="focus-ring block rounded-lg">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function AgentFacingStatus({ status }: { status: CommissionView['status'] }) {
  const label =
    status === 'PENDING' || status === 'VERIFIED'
      ? 'Being checked'
      : status === 'APPROVED'
        ? 'Ready to pay'
        : 'Paid';
  const cls =
    status === 'PENDING' || status === 'VERIFIED'
      ? 'bg-badge-pending-bg text-badge-pending-fg'
      : status === 'APPROVED'
        ? 'bg-badge-approved-bg text-badge-approved-fg'
        : 'bg-badge-paid-bg text-badge-paid-fg';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// Kept as a placeholder so a future "reversal" visual matches the design.
void CommissionStatusBadge;

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${shifted.getUTCDate()} ${months[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}`;
}
