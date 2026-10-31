'use client';

import { Button } from '../primitives/button';

/**
 * The banner that appears above a table when rows are selected.
 * Shows the count, an export action, and a clear action.
 */
export function SelectionBanner({
  count,
  onExport,
  onClear,
  exporting = false,
}: {
  count: number;
  onExport: () => void;
  onClear: () => void;
  exporting?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex items-center justify-between gap-4 rounded border border-success-fg/20 bg-success-bg px-4 py-2 text-sm">
      <span className="font-medium text-success-fg">{count} selected on this page</span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="small"
          onClick={onExport}
          loading={exporting}
          loadingLabel="Exporting…"
        >
          Export selected (CSV)
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="focus-ring rounded text-sm text-text-secondary underline-offset-2 hover:underline"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
