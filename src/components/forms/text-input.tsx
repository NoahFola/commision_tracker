import type { InputHTMLAttributes } from 'react';

/**
 * TextInput — the single text-input primitive.
 *
 * States (per C-01): default, focus, filled, error, disabled.
 *
 * Renders:
 *   - optional label above (with htmlFor wired to the input)
 *   - the input itself
 *   - optional error message below (red, with a small icon)
 *   - optional helper text below (muted) when there is no error
 *
 * Controlled: takes `value` and `onChange`. Parent owns the value
 * (usually the useFormValidation hook from src/lib/forms/).
 *
 * Error state: red border, red focus ring, message below with icon.
 * The parent passes the error string; the component doesn't validate.
 */

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label?: string;
  error?: string;
  helper?: string;
  className?: string;
};

export function TextInput({ id, label, error, helper, className = '', ...rest }: TextInputProps) {
  const inputId = id ?? rest.name;
  const hasError = Boolean(error);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        className={[
          'mt-1 block w-full rounded border bg-surface px-3 py-2 text-sm',
          'text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-offset-1',
          hasError
            ? 'border-danger-fg focus:ring-danger-fg'
            : 'border-border-default focus:border-focus-ring focus:ring-focus-ring',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-tertiary',
        ].join(' ')}
        {...rest}
      />
      {hasError ? (
        <p id={`${inputId}-error`} className="mt-1 flex items-center gap-1 text-xs text-danger-fg">
          <ErrorIcon />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p id={`${inputId}-helper`} className="mt-1 text-xs text-text-tertiary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
