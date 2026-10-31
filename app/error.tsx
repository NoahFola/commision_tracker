'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary.
 *
 * Next.js renders this in place of a route's content when a render,
 * a server component, or a descendant client component throws.
 *
 * Tone (per docs/DESIGN_BRIEF.md §8): direct, factual, no exclamation
 * marks. Never show the raw error message — it may contain internal
 * details. Show the digest (which correlates with server logs) and a
 * WAT timestamp (which a user can quote to support).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[route-error]', error.digest ?? '(no digest)');
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded border border-border-default bg-surface p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-secondary">
          The page could not be loaded. You can try again, or go back to the home page.
        </p>

        <p className="mt-3 text-xs text-text-tertiary">
          {error.digest && (
            <>
              Reference: <code className="font-mono">{error.digest}</code>
              <br />
            </>
          )}
          Time: {formatNowWAT()}
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="focus-ring rounded bg-btn-primary-bg px-4 py-2 text-sm font-medium text-btn-primary-fg hover:bg-btn-primary-bg-hover"
          >
            Try again
          </button>
          <a
            href="/"
            className="focus-ring rounded border border-btn-secondary-border bg-btn-secondary-bg px-4 py-2 text-sm font-medium text-btn-secondary-fg hover:bg-btn-secondary-bg-hover"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}

function formatNowWAT(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 60 * 60 * 1000);
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
  const day = shifted.getUTCDate();
  const month = months[shifted.getUTCMonth()];
  const year = shifted.getUTCFullYear();
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm} WAT`;
}
