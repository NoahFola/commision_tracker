import Link from 'next/link';

/**
 * 404 page. Rendered when a route doesn't match or when notFound() is
 * called from a server component.
 *
 * Tone (per docs/DESIGN_BRIEF.md §8): direct, factual, no exclamation
 * marks.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-neutral">
          The page you are looking for does not exist, or you do not have access to it.
        </p>

        <div className="mt-6 flex gap-2">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
