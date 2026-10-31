'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AgentStatusBadge } from '../primitives/status-badge';
import { OnboardingStageIndicator } from '../onboarding-stage-indicator';
import { CopyButton } from '../primitives/copy-button';
import { SelectionBanner } from '../ui-states/selection-banner';
import { useToast } from '../ui-states/toast-provider';
import type { AgentListItem } from '@/types/agent';

/**
 * The agents table with selection and export.
 *
 * Selection is client state; it does not persist across pages or
 * filters, which is enforced by the caller keying this component on
 * the filter signature. When the key changes, this component is
 * unmounted and a fresh one is mounted with an empty selection — no
 * effect needed, and no stale ids to worry about.
 *
 * Export: opens /api/reports/agents.csv?ids=... via a programmatic
 * anchor click. The browser downloads the file without navigating
 * away. The server writes an EXPORT audit row.
 */
export function AgentTable({ agents }: { agents: AgentListItem[] }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allIds = useMemo(() => agents.map((a) => a.id), [agents]);
  const allSelected = agents.length > 0 && selected.size === agents.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === agents.length ? new Set() : new Set(allIds)));
  }

  function clear() {
    setSelected(new Set());
  }

  async function handleExport() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      for (const id of selected) params.append('ids', id);
      const url = `/api/reports/agents.csv?${params.toString()}`;

      const link = document.createElement('a');
      link.href = url;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${selected.size} agent${selected.size === 1 ? '' : 's'} exported`);
      clear();
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SelectionBanner
        count={selected.size}
        onExport={handleExport}
        onClear={clear}
        exporting={busy}
      />
      <div className="overflow-hidden rounded border border-border-default bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
            <tr>
              <th scope="col" className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="focus-ring h-4 w-4 rounded border-border-default"
                />
              </th>
              <th scope="col" className="px-3 py-2">
                Name
              </th>
              <th scope="col" className="px-3 py-2">
                Type
              </th>
              <th scope="col" className="px-3 py-2">
                Region
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Onboarding stage
              </th>
              <th scope="col" className="px-3 py-2">
                Referral code
              </th>
              <th scope="col" className="px-3 py-2">
                Date joined
              </th>
              <th scope="col" className="w-8 px-3 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const isSelected = selected.has(a.id);
              return (
                <tr
                  key={a.id}
                  className={[
                    'border-t border-border-default',
                    isSelected ? 'bg-success-bg/40' : 'hover:bg-surface-muted',
                  ].join(' ')}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select ${a.fullName}`}
                      checked={isSelected}
                      onChange={() => toggleOne(a.id)}
                      className="focus-ring h-4 w-4 rounded border-border-default"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/admin/agents/${a.id}`}
                      className="focus-ring block rounded font-medium text-text-primary hover:underline"
                    >
                      {a.fullName}
                    </Link>
                    <p className="text-xs text-text-tertiary">{a.phone}</p>
                  </td>
                  <td className="px-3 py-2 align-top text-text-secondary">
                    {a.type === 'AGENT' ? 'Agent' : 'Ambassador'}
                  </td>
                  <td className="px-3 py-2 align-top text-text-secondary">{a.region.name}</td>
                  <td className="px-3 py-2 align-top">
                    <AgentStatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <OnboardingStageIndicator stage={a.onboardingStage} variant="compact" />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-xs">{a.referralCode}</code>
                      <CopyButton value={a.referralCode} variant="icon" />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-text-secondary">
                    {formatShortDate(a.dateJoined)}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      type="button"
                      aria-label={`Actions for ${a.fullName}`}
                      className="focus-ring rounded px-2 py-1 text-text-secondary hover:bg-surface-muted"
                    >
                      …
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

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
  const day = shifted.getUTCDate();
  const month = months[shifted.getUTCMonth()]!;
  const year = shifted.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
