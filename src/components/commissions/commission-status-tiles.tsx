import { CurrencyAmount } from '../primitives/currency-amount';
import type { Money } from '@/lib/money/money';

const TILES = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PAID', label: 'Paid' },
] as const;

export type StatusTile = {
  count: number;
  total: Money;
};

/**
 * The four summary tiles across the top of the commission ledger.
 */
export function CommissionStatusTiles({
  tiles,
}: {
  tiles: Record<(typeof TILES)[number]['key'], StatusTile>;
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map((t) => {
        const tile = tiles[t.key];
        return (
          <div key={t.key} className="rounded border border-border-default bg-surface px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              {t.label}
            </p>
            <p className="mt-1 text-lg font-semibold">
              <CurrencyAmount value={tile.total} />
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {tile.count} commission{tile.count === 1 ? '' : 's'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
