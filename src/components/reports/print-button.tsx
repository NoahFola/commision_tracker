'use client';

/**
 * A simple Print button that triggers the browser's print dialog.
 * The reports page swaps to a stripped-down layout when ?print=1 is
 * present, so this button first navigates to that URL, then calls
 * window.print().
 */
export function PrintButton() {
  function handleClick() {
    const url = new URL(window.location.href);
    url.searchParams.set('print', '1');
    window.location.assign(url.toString());
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="focus-ring rounded border border-btn-secondary-border bg-btn-secondary-bg px-4 py-2 text-sm font-medium hover:bg-btn-secondary-bg-hover"
    >
      Print
    </button>
  );
}
