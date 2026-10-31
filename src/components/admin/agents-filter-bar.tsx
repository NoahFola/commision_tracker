'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FilterBar } from '../primitives/filter-bar';
import { FilterSelect } from '../primitives/filter-select';
import { FilterSegmented } from '../primitives/filter-segmented';
import type { AgentStatus } from '../primitives/status-badge';

const STATUS_OPTIONS: { value: AgentStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const TYPE_OPTIONS: { value: 'AGENT' | 'AMBASSADOR' | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'AMBASSADOR', label: 'Ambassadors' },
];

/**
 * Filter controls for the agents list. Reads current values from the
 * URL and writes changes back to the URL. Server components re-render
 * automatically.
 *
 * `regions` is the list of regions for the region select, provided by
 * the page (server-side fetch).
 */
export function AgentsFilterBar({
  regions,
  trailing,
}: {
  regions: { id: string; name: string }[];
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Any filter change resets to page 1.
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`);
  }

  const status = (search.get('status') as AgentStatus | null) ?? '';
  const type = (search.get('type') as 'AGENT' | 'AMBASSADOR' | null) ?? '';
  const regionId = search.get('regionId') ?? '';

  return (
    <div className="mb-4">
      <FilterBar trailing={trailing}>
        <FilterSelect
          name="status"
          label="Status: All"
          value={status}
          onChange={(v) => setParam('status', v)}
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <FilterSegmented
          name="type"
          value={type}
          onChange={(v) => setParam('type', v)}
          options={TYPE_OPTIONS}
        />
        <FilterSelect
          name="regionId"
          label="Region: All"
          value={regionId}
          onChange={(v) => setParam('regionId', v)}
          options={regions.map((r) => ({ value: r.id, label: r.name }))}
        />
      </FilterBar>
    </div>
  );
}
