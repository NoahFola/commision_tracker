/**
 * Projects the "next payout" date for an agent, shown on their home
 * page as "Expected on 31 Oct 2026". There is no scheduled-payout-date
 * field in the data model (design feedback A-7). We compute a
 * projection from the current period:
 *
 *   - The current WAT month, from `new Date()`.
 *   - The projected payout date is the last day of the following month
 *     — the standard convention for our monthly payout cycle.
 *
 * This is a projection, not a promise. When the operations team needs a
 * real scheduled-payout field, this function is the one place to change.
 */
export function nextPayoutProjection(now: Date = new Date()): {
  iso: string;
  display: string;
} {
  // WAT = UTC+1, no DST.
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  const year = wat.getUTCFullYear();
  const month = wat.getUTCMonth(); // 0-11

  // Following month. If we're in December, roll to January of next year.
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  // Last day of the following month.
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const iso = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const display = `${lastDay} ${months[nextMonth]} ${nextYear}`;

  return { iso, display };
}
