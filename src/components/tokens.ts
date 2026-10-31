/**
 * Semantic colour names. Components refer to these constants rather
 * than to raw hex strings, so a palette change is one edit in
 * globals.css.
 */
export const COLOURS = {
  badge: {
    active: { fg: 'text-badge-active-fg', bg: 'bg-badge-active-bg' },
    inactive: { fg: 'text-badge-inactive-fg', bg: 'bg-badge-inactive-bg' },
    suspended: { fg: 'text-badge-suspended-fg', bg: 'bg-badge-suspended-bg' },
    terminated: { fg: 'text-badge-terminated-fg', bg: 'bg-badge-terminated-bg' },
    pending: { fg: 'text-badge-pending-fg', bg: 'bg-badge-pending-bg' },
    verified: { fg: 'text-badge-verified-fg', bg: 'bg-badge-verified-bg' },
    approved: { fg: 'text-badge-approved-fg', bg: 'bg-badge-approved-bg' },
    paid: { fg: 'text-badge-paid-fg', bg: 'bg-badge-paid-bg' },
    draft: { fg: 'text-badge-draft-fg', bg: 'bg-badge-draft-bg' },
    processing: { fg: 'text-badge-processing-fg', bg: 'bg-badge-processing-bg' },
    failed: { fg: 'text-badge-failed-fg', bg: 'bg-badge-failed-bg' },
  },
  text: {
    primary: 'text-text-primary',
    secondary: 'text-text-secondary',
    tertiary: 'text-text-tertiary',
  },
} as const;
