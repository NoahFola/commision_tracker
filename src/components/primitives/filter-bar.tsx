import type { ReactNode } from 'react';

/**
 * Container for a row of filters. Handles layout only: wraps on small
 * screens, aligns to the left, and reserves space for a trailing area
 * (e.g. "Showing 1–10 of 138").
 */
export function FilterBar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {trailing && <div className="ml-auto text-xs text-text-tertiary">{trailing}</div>}
    </div>
  );
}
