'use client';

import { useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning';

export type ToastData = {
  id: string;
  variant: ToastVariant;
  title: string;
  /** Optional secondary line. */
  description?: string;
  /** ms until auto-dismiss; null means never. */
  autoDismissMs: number | null;
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success-fg bg-success-bg text-success-fg',
  error: 'border-danger-fg bg-danger-bg text-danger-fg',
  warning: 'border-warning-fg bg-warning-bg text-warning-fg',
};

export function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.autoDismissMs === null) return;
    const t = setTimeout(onDismiss, toast.autoDismissMs);
    return () => clearTimeout(t);
  }, [toast.autoDismissMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={[
        'flex w-full items-start gap-3 rounded border px-4 py-3 shadow-sm',
        VARIANT_CLASSES[toast.variant],
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="focus-ring shrink-0 rounded p-1 hover:bg-black/5"
      >
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
