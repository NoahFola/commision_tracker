'use client';

import { useState } from 'react';

/**
 * Copies a value to the clipboard.
 *
 *   variant="text"   underlined "Copy" / "Copied" (default)
 *   variant="icon"   a small icon-only button, for tight spaces
 */

export function CopyButton({
  value,
  label,
  variant = 'text',
}: {
  value: string;
  label?: string;
  variant?: 'text' | 'icon';
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail on insecure contexts; do nothing.
    }
  }

  const ariaLabel = label ?? `Copy ${value}`;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={ariaLabel}
        className="focus-ring rounded p-1 text-text-secondary hover:bg-surface-muted"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={ariaLabel}
      className="focus-ring text-xs text-text-secondary underline-offset-2 hover:underline"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
