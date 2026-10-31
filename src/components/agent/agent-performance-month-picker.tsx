'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../primitives/button';

/**
 * Month picker with prev/next arrows, matching the mockup's
 * `< Sep 2026 >` header. Writes ?period=YYYY-MM to the URL.
 */
export function AgentPerformanceMonthPicker({ period }: { period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function navigate(deltaMonths: number) {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams(search.toString());
    params.set('period', next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const [y, m] = period.split('-');
  const label = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="small" onClick={() => navigate(-1)} aria-label="Previous month">
        ‹
      </Button>
      <span className="text-sm font-medium">{label}</span>
      <Button variant="ghost" size="small" onClick={() => navigate(1)} aria-label="Next month">
        ›
      </Button>
    </div>
  );
}
