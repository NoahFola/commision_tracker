import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

/**
 * Button — the single interactive-action primitive.
 *
 * Variants (per C-01):
 *   primary    solid green, white text. Next action on a page.
 *   secondary  outlined, neutral. Secondary actions, including row
 *              actions.
 *   danger     solid red. Confirm step in a destructive dialog.
 *   ghost      text-only. Red for destructive, neutral otherwise.
 *
 * Sizes:
 *   default    px-4 py-2
 *   small      px-3 py-1, smaller text. Row actions.
 *
 * States: default, hover, active, focus, disabled — all handled by
 * Tailwind variants. The button also accepts `loading` (disables it
 * and shows `loadingLabel`).
 *
 * Polymorphic: `as="button"` (default), `as="a"` for external links,
 * `as="link"` for Next.js client-side navigation. All share the same
 * styling.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'default' | 'small';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-btn-primary-bg text-btn-primary-fg hover:bg-btn-primary-bg-hover disabled:opacity-50',
  secondary:
    'border border-btn-secondary-border bg-btn-secondary-bg text-btn-secondary-fg hover:bg-btn-secondary-bg-hover disabled:opacity-50',
  danger: 'bg-btn-danger-bg text-btn-danger-fg hover:bg-btn-danger-bg-hover disabled:opacity-50',
  ghost: 'text-btn-ghost-fg hover:text-btn-ghost-fg-hover disabled:opacity-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'px-4 py-2 text-sm',
  small: 'px-3 py-1 text-xs',
};

function classes(variant: ButtonVariant, size: ButtonSize, className: string): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded font-medium',
    'focus-ring',
    'disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'default',
  loading = false,
  loadingLabel,
  className = '',
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classes(variant, size, className)}
      {...rest}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ButtonLink — for anchors, internal or external
// ---------------------------------------------------------------------------

export type ButtonLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'className' | 'href'
> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'default',
  className = '',
  children,
  ...rest
}: ButtonLinkProps) {
  const isInternal = href.startsWith('/');
  const cls = classes(variant, size, className);

  if (isInternal) {
    return (
      <Link href={href} className={cls} {...(rest as object)}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  );
}
