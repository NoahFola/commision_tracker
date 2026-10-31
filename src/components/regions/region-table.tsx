import type { RegionView } from '@/types/region';

export function RegionsTable({ regions }: { regions: RegionView[] }) {
  if (regions.length === 0) {
    return (
      <div className="rounded border border-border-default bg-surface px-6 py-12 text-center text-sm text-text-secondary">
        No regions yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-border-default bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2">
              Name
            </th>
            <th scope="col" className="px-3 py-2">
              Code
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {regions.map((r) => (
            <tr key={r.id} className="border-t border-border-default">
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">{r.code ?? '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    r.isActive
                      ? 'bg-success-bg text-success-fg'
                      : 'bg-surface-muted text-text-secondary',
                  ].join(' ')}
                >
                  {r.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
