import type { ReactNode } from 'react';
import { ButtonLink } from '../primitives/button';
import { Button } from '../primitives/button';

/**
 * Empty state for a table or list. Two variants per the design:
 *
 *   no-matches   The filters are too narrow. CTA: clear filters.
 *   first-use    There is nothing here yet. CTA: create the first one.
 *
 * Both use a simple icon, a headline, a description, and a single
 * action. No illustration.
 */

export function EmptyState({
  variant,
  entityLabel,
  actionLabel,
  actionHref,
  onAction,
}: {
  variant: 'no-matches' | 'first-use';
  /** E.g. "commissions". Used in the headline. */
  entityLabel: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const headline =
    variant === 'no-matches'
      ? `No ${entityLabel} match these filters.`
      : `No ${entityLabel} yet. ${capitalize(actionLabel)}.`;
  const description = variant === 'no-matches' ? undefined : undefined;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-text-tertiary">
        {variant === 'no-matches' ? <SearchIcon /> : <ListIcon />}
      </div>
      <p className="mt-4 text-sm font-medium text-text-primary">{headline}</p>
      {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
      <div className="mt-6">
        {actionHref ? (
          <ButtonLink href={actionHref} variant="primary">
            {actionLabel}
          </ButtonLink>
        ) : (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function SearchIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
