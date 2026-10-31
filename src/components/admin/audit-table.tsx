import { DateTime } from '../primitives/date-time';

export type AuditRow = {
  id: string;
  at: string;
  action: string;
  actor: { name: string; type: 'ADMIN' | 'AGENT' };
  before: unknown;
  after: unknown;
  reason: string | null;
};

/**
 * Table of audit rows, newest first. Read-only. Used by the agent
 * detail's Audit tab.
 */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-hidden rounded border border-border-default bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs font-medium text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2">When (WAT)</th>
            <th scope="col" className="px-3 py-2">Action</th>
            <th scope="col" className="px-3 py-2">By</th>
            <th scope="col" className="px-3 py-2">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border-default align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                <DateTime value={r.at} variant="datetime" />
              </td>
              <td className="px-3 py-2 font-medium">{r.action}</td>
              <td className="px-3 py-2">
                <p className="font-medium">{r.actor.name}</p>
                <p className="text-xs text-text-tertiary">
                  {r.actor.type === 'ADMIN' ? 'Admin' : 'Agent'}
                </p>
              </td>
              <td className="px-3 py-2 text-xs text-text-secondary">
                <ChangeSummary before={r.before} after={r.after} action={r.action} />
                {r.reason && <p className="mt-1 text-text-tertiary">Reason: {r.reason}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-text-secondary">
          No audit rows yet.
        </div>
      )}
    </div>
  );
}

/**
 * Renders a compact "field: before -> after" summary from the diff
 * snapshots. Only top-level primitive fields are shown. Nested
 * objects are summarised as "(updated)".
 */
function ChangeSummary({
  before,
  after,
  action,
}: {
  before: unknown;
  after: unknown;
  action: string;
}) {
  if (action === 'CREATE') {
    return <span>Created</span>;
  }
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return <span>—</span>;
  }
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const parts: string[] = [];
  for (const k of keys) {
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    const bs = stringifyShort(bv);
    const as = stringifyShort(av);
    parts.push(`${k}: ${bs} → ${as}`);
  }
  if (parts.length === 0) return <span>—</span>;
  return <span>{parts.join(' · ')}</span>;
}

function stringifyShort(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return '(updated)';
}