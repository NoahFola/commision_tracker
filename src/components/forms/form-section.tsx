import type { ReactNode } from 'react';

/**
 * A titled section of a form. Consistent padding and border so
 * consecutive sections stack cleanly.
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-border-default bg-surface p-5">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
