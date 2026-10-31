import { Button } from '../primitives/button';

/**
 * Error state for a table, list, or the whole page. Renders as a red
 * banner with a title, a description, and an optional "Try again"
 * action.
 *
 * The design's copy is direct: "Commissions did not load. The server
 * did not respond. Nothing was changed. Check your connection and try
 * again."
 */
export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="m-4 rounded border border-danger-fg bg-danger-bg px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <WarningIcon />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-danger-fg">{title}</p>
          {description && <p className="mt-1 text-danger-fg/80">{description}</p>}
          {onRetry && (
            <div className="mt-3">
              <Button variant="secondary" size="small" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-danger-fg"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
