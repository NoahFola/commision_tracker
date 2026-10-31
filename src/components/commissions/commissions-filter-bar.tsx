'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterBar } from '../primitives/filter-bar';
import { FilterSelect } from '../primitives/filter-select';
import { FilterPeriod } from '../primitives/filter-period';
import { FilterSearch } from '../primitives/filter-search';
import type { CommissionStatus } from '../primitives/status-badge';

const STATUS_OPTIONS: { value: CommissionStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
];

export function CommissionsFilterBar({
  agents,
  trailing,
}: {
  agents: { id: string; name: string }[];
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`);
  }

  const status = (search.get('status') as CommissionStatus | null) ?? '';
  const agentId = search.get('agentId') ?? '';
  const period = search.get('period') ?? '';
  const searchQ = search.get('q') ?? '';

  return (
    <div className="mb-4">
      <FilterBar trailing={trailing}>
        <FilterSearch
          name="q"
          placeholder="Search customer ID"
          value={searchQ}
          onChange={(v) => setParam('q', v)}
        />
        <FilterSelect
          name="status"
          label="Status: All"
          value={status}
          onChange={(v) => setParam('status', v)}
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <FilterSelect
          name="agentId"
          label="Agent: All"
          value={agentId}
          onChange={(v) => setParam('agentId', v)}
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
        />
        <FilterPeriod
          name="period"
          label="Period"
          value={period}
          onChange={(v) => setParam('period', v)}
        />
      </FilterBar>
    </div>
  );
}
