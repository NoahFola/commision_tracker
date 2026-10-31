/**
 * West Africa Time (WAT) = UTC+1.
 * Cameroon has never observed DST, so the offset is a fixed constant.
 *
 * Period boundaries in this system are WAT. Timestamps are stored as UTC;
 * convert to WAT only when computing a period boundary or a day key.
 */
export const WAT_OFFSET_MINUTES = 60;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Throws if `dayKey` is not a well-formed 'YYYY-MM-DD' string. */
export function assertDayKey(dayKey: string): void {
  if (typeof dayKey !== 'string' || !DAY_KEY_RE.test(dayKey)) {
    throw new Error(`Invalid dayKey: ${String(dayKey)}`);
  }
}

/**
 * Returns the UTC Date corresponding to 00:00 WAT of `dayKey`.
 * Inverse of `watDayKey`. Throws on malformed input.
 */
export function watDayToDate(dayKey: string): Date {
  assertDayKey(dayKey);
  const [y, m, d] = dayKey.split('-').map((s) => Number.parseInt(s, 10));
  // Construct as if the calendar date were UTC, then shift back by the
  // WAT offset to get the UTC instant at WAT midnight.
  const utcMidnight = Date.UTC(y as number, (m as number) - 1, d as number, 0, 0, 0, 0);
  return new Date(utcMidnight - WAT_OFFSET_MINUTES * MS_PER_MINUTE);
}

/**
 * Returns the UTC Date corresponding to the start (00:00) of the WAT day
 * that contains `date`.
 */
export function watDayStart(date: Date): Date {
  const shifted = new Date(date.getTime() + WAT_OFFSET_MINUTES * MS_PER_MINUTE);
  const dayIndex = Math.floor(shifted.getTime() / MS_PER_DAY);
  const utcMidnightOfShiftedDay = dayIndex * MS_PER_DAY;
  return new Date(utcMidnightOfShiftedDay - WAT_OFFSET_MINUTES * MS_PER_MINUTE);
}

/**
 * Day key in WAT, formatted YYYY-MM-DD.
 */
export function watDayKey(date: Date): string {
  const shifted = new Date(date.getTime() + WAT_OFFSET_MINUTES * MS_PER_MINUTE);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Period key in WAT, formatted YYYY-MM.
 * Used for commission qualification periods.
 */
export function watPeriod(date: Date): string {
  const shifted = new Date(date.getTime() + WAT_OFFSET_MINUTES * MS_PER_MINUTE);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns the 'YYYY-MM-DD' of the Monday that starts the WAT week
 * containing `dayKey`. Week starts on Monday (ISO convention).
 *
 * Uses UTC arithmetic internally so there is no DST complexity — WAT is
 * a fixed +60 minute offset with no DST.
 */
export function watWeekStart(dayKey: string): string {
  assertDayKey(dayKey);
  const [y, m, d] = dayKey.split('-').map((s) => Number.parseInt(s, 10));
  // Build the calendar date as UTC midnight, then find its Monday.
  const date = new Date(Date.UTC(y as number, (m as number) - 1, d as number));
  // getUTCDay: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  const dow = date.getUTCDay();
  // Days to subtract to land on Monday: Mon=0, Tue=1, ..., Sun=6.
  const daysBack = (dow + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysBack);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
