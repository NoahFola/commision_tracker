'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/primitives/button';

export default function AgentRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[agent-route-error]', error.digest ?? '(no digest)');
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded border border-border-default bg-surface p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-secondary">
          The page could not be loaded. You can try again, or go back to the home page.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-text-tertiary">
            Reference: <code className="font-mono">{error.digest}</code>
            <br />
            Time: {formatNowWAT()}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/"
            className="focus-ring rounded border border-btn-secondary-border bg-btn-secondary-bg px-4 py-2 text-sm font-medium text-btn-secondary-fg hover:bg-btn-secondary-bg-hover"
          >
            Go home
          </Link>
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
