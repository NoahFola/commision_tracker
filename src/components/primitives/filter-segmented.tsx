/**
 * A segmented control (three or more pill-shaped buttons, one active).
 * Used for the "All / Agents / Ambassadors" filter on the agents list.
 *
 * Controlled: takes `value` ('' means no filter) and `onChange`.
 */
export function FilterSegmented<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: { value: T | ''; label: string }[];
}) {
  return (
    <div
      role="group"
      aria-label={name}
      className="inline-flex rounded border border-border-default bg-surface p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={[
              'focus-ring rounded px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-success-bg font-medium text-success-fg'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
