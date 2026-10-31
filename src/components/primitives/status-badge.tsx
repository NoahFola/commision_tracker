import type { ReactNode } from 'react';

/**
 * Status badge — the visual pill used everywhere a status appears.
 *
 * Three wrapper components (Agent, Commission, Batch) sit on top of a
 * shared primitive. The wrappers narrow the domain: passing
 * `<AgentStatusBadge status="PAID" />` is a type error, because PAID
 * isn't an agent status. This prevents enum leakage across domains and
 * means a colour change to one domain doesn't affect the others.
 *
 * The Reversal badge is outlined rather than filled. It appears
 * alongside a status badge (Reversal + Pending), which is why the two
 * are separate: one shows the row's kind, the other its state.
 */

type BadgeColours = {
  fg: string;
  bg: string;
  border?: string;
};

function Primitive({
  label,
  colours,
  outline = false,
}: {
  label: ReactNode;
  colours: BadgeColours;
  outline?: boolean;
}) {
  const style = outline
    ? {
        color: colours.fg,
        background: colours.bg,
        borderColor: colours.border ?? colours.fg,
      }
    : { color: colours.fg, background: colours.bg };

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        outline ? 'border' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Agent statuses
// ---------------------------------------------------------------------------

export type AgentStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';

const AGENT_STATUS_COLOURS: Record<AgentStatus, BadgeColours> = {
  ACTIVE: { fg: 'var(--badge-active-fg)', bg: 'var(--badge-active-bg)' },
  SUSPENDED: { fg: 'var(--badge-suspended-fg)', bg: 'var(--badge-suspended-bg)' },
  INACTIVE: { fg: 'var(--badge-inactive-fg)', bg: 'var(--badge-inactive-bg)' },
  TERMINATED: { fg: 'var(--badge-terminated-fg)', bg: 'var(--badge-terminated-bg)' },
};

const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
  TERMINATED: 'Terminated',
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <Primitive label={AGENT_STATUS_LABELS[status]} colours={AGENT_STATUS_COLOURS[status]} />;
}

// ---------------------------------------------------------------------------
// Commission statuses
// ---------------------------------------------------------------------------

export type CommissionStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'PAID';

const COMMISSION_STATUS_COLOURS: Record<CommissionStatus, BadgeColours> = {
  PENDING: { fg: 'var(--badge-pending-fg)', bg: 'var(--badge-pending-bg)' },
  VERIFIED: { fg: 'var(--badge-verified-fg)', bg: 'var(--badge-verified-bg)' },
  APPROVED: { fg: 'var(--badge-approved-fg)', bg: 'var(--badge-approved-bg)' },
  PAID: { fg: 'var(--badge-paid-fg)', bg: 'var(--badge-paid-bg)' },
};

const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  PAID: 'Paid',
};

export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  return (
    <Primitive
      label={COMMISSION_STATUS_LABELS[status]}
      colours={COMMISSION_STATUS_COLOURS[status]}
    />
  );
}

/**
 * The Reversal badge is a marker of KIND, not STATUS. It sits next to
 * a commission's real status badge on the same row. Outlined, not
 * filled, to distinguish it visually.
 */
export function ReversalBadge() {
  return (
    <Primitive
      label="Reversal"
      colours={{
        fg: 'var(--badge-reversal-fg)',
        bg: 'var(--badge-reversal-bg)',
        border: 'var(--badge-reversal-border)',
      }}
      outline
    />
  );
}

// ---------------------------------------------------------------------------
// Batch statuses
// ---------------------------------------------------------------------------

export type BatchStatus = 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED';

const BATCH_STATUS_COLOURS: Record<BatchStatus, BadgeColours> = {
  DRAFT: { fg: 'var(--badge-draft-fg)', bg: 'var(--badge-draft-bg)' },
  APPROVED: { fg: 'var(--badge-approved-fg)', bg: 'var(--badge-approved-bg)' },
  PROCESSING: { fg: 'var(--badge-processing-fg)', bg: 'var(--badge-processing-bg)' },
  PAID: { fg: 'var(--badge-paid-fg)', bg: 'var(--badge-paid-bg)' },
  FAILED: { fg: 'var(--badge-failed-fg)', bg: 'var(--badge-failed-bg)' },
};

const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  FAILED: 'Failed',
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  return <Primitive label={BATCH_STATUS_LABELS[status]} colours={BATCH_STATUS_COLOURS[status]} />;
}
