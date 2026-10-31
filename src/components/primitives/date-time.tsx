
/**
 * Date/time formatter for the WAT timezone.
 *
 * Display forms (per design):
 *   - date:     "30 Sep 2026"
 *   - time:     "14:23"
 *   - datetime: "30 Sep 2026, 14:23 WAT"
 *
 * The input is an ISO string (what the API returns). The output is
 * WAT, regardless of the server's local timezone.
 *
 * `relative` renders an additional line with "10 days ago". This
 * requires the client to know the current time, so when `relative` is
 * true the component delegates to a small client subcomponent. The
 * server-rendered HTML shows the absolute time, and the relative line
 * is added after hydration — a small layout shift on first load, not
 * a hydration mismatch.
 */

import { RelativeTime } from "./relative-time";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type DateTimeVariant = 'date' | 'time' | 'datetime';

function toWatParts(iso: string): {
  day: number;
  month: string;
  year: number;
  hh: string;
  mm: string;
} {
  const d = new Date(iso);
  // WAT = UTC+1, no DST.
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  return {
    day: shifted.getUTCDate(),
    month: MONTHS[shifted.getUTCMonth()]!,
    year: shifted.getUTCFullYear(),
    hh: String(shifted.getUTCHours()).padStart(2, '0'),
    mm: String(shifted.getUTCMinutes()).padStart(2, '0'),
  };
}

export function DateTime({
  value,
  variant = 'datetime',
  relative = false,
}: {
  value: string | Date;
  variant?: DateTimeVariant;
  relative?: boolean;
}) {
  const iso = typeof value === 'string' ? value : value.toISOString();
  const p = toWatParts(iso);
  const datePart = `${p.day} ${p.month} ${p.year}`;
  const timePart = `${p.hh}:${p.mm} WAT`;

  const absolute = (() => {
    switch (variant) {
      case 'date':
        return datePart;
      case 'time':
        return timePart;
      case 'datetime':
        return `${datePart}, ${timePart}`;
    }
  })();

  return (
    <span className="inline-flex flex-col">
      <span>{absolute}</span>
      {relative && <RelativeTime iso={iso} />}
    </span>
  );
}
