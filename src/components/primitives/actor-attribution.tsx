import { DateTime } from './date-time';

/**
 * Attribution line for an audited action.
 *
 *   variant="sentence"   "Verified by M.-C. Fosto on 30 Sep 2026 at 14:23 WAT"
 *   variant="cell"       "M.-C. Fosto · 30 Sep 2026, 14:23 WAT"
 *   variant="table-cell" two lines: name on top, timestamp below
 *
 * The verb ("Verified by") varies by action. The caller supplies it
 * via `prefix`; the component formats the name and the timestamp.
 */

export type ActorType = 'ADMIN' | 'AGENT';

export function ActorAttribution({
  name,
  type,
  at,
  prefix,
  variant = 'sentence',
}: {
  name: string;
  type: ActorType;
  at: string | Date;
  prefix?: string;
  variant?: 'sentence' | 'cell' | 'table-cell';
}) {
  // For MVP, we don't visually distinguish admin vs agent in the name
  // itself. If the design later wants a role badge, this is where it
  // goes. The `type` prop is accepted now so callers don't have to
  // change when we add it.
  void type;

  if (variant === 'sentence') {
    return (
      <span className="text-sm text-text-secondary">
        {prefix ? `${prefix} ` : ''}
        <span className="font-medium text-text-primary">{name}</span>
        {' on '}
        <DateTime value={at} variant="datetime" />
      </span>
    );
  }

  if (variant === 'cell') {
    return (
      <span className="text-sm">
        <span className="font-medium text-text-primary">{name}</span>
        <span className="text-text-secondary"> · </span>
        <DateTime value={at} variant="datetime" />
      </span>
    );
  }

  // table-cell
  return (
    <span className="flex flex-col leading-tight">
      <span className="font-medium text-text-primary">{name}</span>
      <span className="text-xs text-text-secondary">
        <DateTime value={at} variant="datetime" />
      </span>
    </span>
  );
}
