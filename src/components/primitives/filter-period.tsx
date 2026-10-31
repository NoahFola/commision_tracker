/**
 * Month picker for a filter bar. Uses the native <input type="month">
 * so the picker behaves the way users expect on both desktop and
 * mobile.
 *
 * Controlled: takes `value` (YYYY-MM or '') and `onChange`.
 */
export function FilterPeriod({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="sr-only">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring rounded border border-border-default bg-surface px-3 py-2 text-sm"
      />
    </div>
  );
}
