import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingSkeleton } from './loading-skeleton';

/**
 * The wrapper around any list. Renders one of four states:
 *
 *   loading    skeleton rows
 *   error      red banner with a retry action
 *   empty      no-matches or first-use, with a CTA
 *   loaded     the children
 *
 * The caller renders the actual table or list inside `children`. This
 * component only decides which wrapper to show.
 *
 * Filters are rendered above the shell (by the caller, using
 * FilterBar) so they stay visible while the table is loading.
 */

export type TableShellState = 'loaded' | 'loading' | 'error' | 'empty';

export function TableShell({
  state,
  // loading
  skeletonRows = 5,
  skeletonColumns = 4,
  // empty
  emptyVariant = 'no-matches',
  emptyEntityLabel,
  emptyActionLabel,
  emptyActionHref,
  onEmptyAction,
  // error
  errorTitle,
  errorDescription,
  onRetry,
  // loaded
  children,
}: {
  state: TableShellState;
  skeletonRows?: number;
  skeletonColumns?: number;
  emptyVariant?: 'no-matches' | 'first-use';
  emptyEntityLabel?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  if (state === 'loading') {
    return <LoadingSkeleton rows={skeletonRows} columns={skeletonColumns} />;
  }
  if (state === 'error') {
    return (
      <ErrorState
        title={errorTitle ?? 'Could not load.'}
        description={errorDescription}
        onRetry={onRetry}
      />
    );
  }
  if (state === 'empty') {
    return (
      <EmptyState
        variant={emptyVariant}
        entityLabel={emptyEntityLabel ?? 'items'}
        actionLabel={emptyActionLabel ?? 'Create the first'}
        actionHref={emptyActionHref}
        onAction={onEmptyAction}
      />
    );
  }
  return <>{children}</>;
}
