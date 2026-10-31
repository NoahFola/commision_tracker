/**
 * Minimal RFC 4180 CSV writer. No dependency.
 *
 * Rules:
 *   - Fields are quoted if they contain a comma, a double quote, or a
 *     newline. Quotes inside a field are doubled.
 *   - Rows are separated by \r\n.
 *   - No BOM. If a downstream tool (older Excel) mangles UTF-8, add
 *     '\uFEFF' as the first character — one line change.
 */

const CSV_NEWLINE = '\r\n';

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serializes an array of objects to CSV. Column order is fixed by
 * `headers`; any key in a row not present in `headers` is ignored.
 */
export function toCsv<T extends Record<string, unknown>>(
  headers: readonly (keyof T & string)[],
  rows: readonly T[],
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeField).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(','));
  }
  return lines.join(CSV_NEWLINE) + CSV_NEWLINE;
}

/**
 * Formats a Date as an ISO string for a CSV cell. Undefined becomes an
 * empty string (blank cell), not the literal "undefined".
 */
export function csvDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Filename-safe timestamp suffix: YYYYMMDD-HHmmss in UTC.
 */
export function csvTimestampSuffix(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}
