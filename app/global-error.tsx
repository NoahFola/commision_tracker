'use client';

/**
 * Last-resort error boundary. Renders when an error is thrown inside
 * the root layout itself — the only place error.tsx cannot catch.
 *
 * Because the root layout has failed, we cannot rely on it. This
 * component renders its own <html> and <body>, and uses inline styles
 * only: the Tailwind stylesheet may not be loaded.
 *
 * Deliberately minimal. There is nothing to offer the user except a
 * message and a link home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#ffffff',
          color: '#171717',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: '420px', width: '100%' }}>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              margin: '0 0 8px 0',
            }}
          >
            EpsiHome Tracker is temporarily unavailable
          </h1>
          <p style={{ fontSize: '14px', color: '#525252', margin: '0 0 16px 0' }}>
            The application failed to start. This is not caused by anything you did. Please try
            again in a moment.
          </p>

          <p
            style={{
              fontSize: '12px',
              color: '#525252',
              margin: '0 0 16px 0',
            }}
          >
            {error.digest && (
              <>
                Reference: <code style={{ fontFamily: 'monospace' }}>{error.digest}</code>
                <br />
              </>
            )}
            Time: {formatNowWAT()}
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '4px',
                background: '#1d4ed8',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid rgba(82,82,82,0.3)',
                borderRadius: '4px',
                color: '#171717',
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
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