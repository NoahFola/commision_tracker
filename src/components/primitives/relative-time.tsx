'use client';

import { useEffect, useState } from 'react';

/**
 * "10 days ago" / "in 2 hours" relative to now.
 *
 * Computed on the client, because it depends on the current time.
 * Suppresses hydration warnings because the server-rendered HTML is
 * empty (a placeholder) and the client fills it in.
 */

function humanize(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.round((now - then) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 60) return diffSeconds >= 0 ? 'just now' : 'in a moment';
  const minutes = Math.round(diffSeconds / 60);
  if (Math.abs(minutes) < 60) {
    return minutes > 0 ? `${minutes} min ago` : `in ${-minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return hours > 0 ? `${hours} h ago` : `in ${-hours} h`;
  }
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return days > 0 ? `${days} d ago` : `in ${-days} d`;
  }
  const months = Math.round(days / 30);
  return months > 0 ? `${months} mo ago` : `in ${-months} mo`;
}

export function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    setLabel(humanize(iso, Date.now()));
  }, [iso]);

  return (
    <span suppressHydrationWarning className="text-xs text-text-tertiary">
      {label}
    </span>
  );
}
