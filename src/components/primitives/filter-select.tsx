/**
 * A labelled select, styled consistently with TextInput.
 * Controlled: takes `value` and `onChange`.
 */
export function FilterSelect<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
}: {
  name: string;
  label: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={name} className="sr-only">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className="focus-ring rounded border border-border-default bg-surface px-3 py-2 text-sm"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
