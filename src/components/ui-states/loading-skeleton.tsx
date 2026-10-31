/**
 * Skeleton rows for a table. The design says "skeleton rows, never a
 * spinner." Renders `rows` rows, each with `columns` grey bars.
 *
 * The bars are evenly spaced and fixed-width per column. A caller that
 * wants column-specific widths can pass an array of widths.
 */
export function LoadingSkeleton({
  rows = 5,
  columns = 4,
  columnWidths,
}: {
  rows?: number;
  columns?: number;
  /** Optional per-column CSS width strings. Length must equal `columns`. */
  columnWidths?: string[];
}) {
  const widths =
    columnWidths ?? Array.from({ length: columns }, (_, i) => (i === 0 ? '40%' : '20%'));
  return (
    <div role="status" aria-label="Loading" className="space-y-3 py-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4">
          {widths.map((w, c) => (
            <div
              key={c}
              className="h-4 animate-pulse rounded bg-surface-muted"
              style={{ width: w }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
