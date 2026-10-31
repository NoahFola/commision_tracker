'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Two-option export menu: the current filter, or the entire ledger.
 * Both links hit /api/reports/commissions.csv, which writes an
 * EXPORT audit row.
 */
export function CommissionsExportMenu() {
  const [open, setOpen] = useState(false);
  const search = useSearchParams();

  const viewParams = new URLSearchParams();
  const status = search.get('status');
  const agentId = search.get('agentId');
  const period = search.get('period');
  const q = search.get('q');
  if (status) viewParams.set('status', status);
  if (agentId) viewParams.set('agentId', agentId);
  if (period) viewParams.set('period', period);
  if (q) viewParams.set('q', q);
  const viewHref = `/api/reports/commissions.csv${viewParams.size ? `?${viewParams.toString()}` : ''}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring rounded border border-btn-secondary-border bg-btn-secondary-bg px-3 py-2 text-sm font-medium hover:bg-btn-secondary-bg-hover"
      >
        Export ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-72 rounded border border-border-default bg-surface p-1 shadow-lg"
          onClick={() => setOpen(false)}
        >
          <a
            role="menuitem"
            href={viewHref}
            className="focus-ring block rounded px-3 py-2 text-sm hover:bg-surface-muted"
          >
            <p className="font-medium">This view</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Exports the currently filtered set.
            </p>
          </a>
          <a
            role="menuitem"
            href="/api/reports/commissions.csv"
            className="focus-ring block rounded px-3 py-2 text-sm hover:bg-surface-muted"
          >
            <p className="font-medium">All commissions</p>
            <p className="mt-0.5 text-xs text-text-secondary">Every period, status and agent.</p>
          </a>
          <p className="mt-1 px-3 py-1 text-[11px] text-text-tertiary">
            CSV file. Every export is recorded in the audit log with the filters used.
          </p>
        </div>
      )}
    </div>
  );
}
