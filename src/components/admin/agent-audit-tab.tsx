import { AuditTable, type AuditRow } from './audit-table';
import { Pagination } from '../ui-states/pagination';

export function AgentAuditTab({
  rows,
  page,
  limit,
  total,
}: {
  rows: AuditRow[];
  page: number;
  limit: number;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-tertiary">
        Entries are never edited or removed. CSV exports are logged too,
        but are not shown in this view.
      </p>
      <AuditTable rows={rows} />
      {total > 0 && <Pagination page={page} limit={limit} total={total} />}
    </div>
  );
}