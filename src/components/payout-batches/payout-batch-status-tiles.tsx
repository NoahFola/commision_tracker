import { CurrencyAmount } from '../primitives/currency-amount';
import type { BatchStatusBucket } from '@/services/report.service';

const TILES = [
  { key: 'DRAFT', label: 'Draft', caption: 'Waiting for approval' },
  { key: 'APPROVED', label: 'Approved', caption: 'Ready to send' },
  { key: 'PROCESSING', label: 'Processing', caption: 'Sent, waiting for confirmation' },
  { key: 'FAILED', label: 'Failed', caption: 'Needs a new batch' },
] as const;

export function PayoutBatchStatusTiles({
  tiles,
}: {
  tiles: {
    DRAFT: BatchStatusBucket;
    APPROVED: BatchStatusBucket;
    PROCESSING: BatchStatusBucket;
    PAID: BatchStatusBucket;
    FAILED: BatchStatusBucket;
  };
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map((t) => {
        const tile = tiles[t.key];
        return (
          <div key={t.key} className="rounded border border-border-default bg-surface px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                {t.label}
              </p>
              <p className="text-xs text-text-secondary">
                {tile.count} batch{tile.count === 1 ? '' : 'es'}
              </p>
            </div>
            <p className="mt-1 text-lg font-semibold">
              <CurrencyAmount value={tile.total} />
            </p>
            <p className="mt-1 text-xs text-text-secondary">{t.caption}</p>
          </div>
        );
      })}
    </div>
  );
}
