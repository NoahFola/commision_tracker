'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ToastItem, type ToastData, type ToastVariant } from './toast';

/**
 * Toast queue and renderer.
 *
 * Mounted once in the root layout. Components anywhere below can call
 * useToast() to push a toast.
 *
 * Behaviour:
 *   - Success and warning toasts auto-dismiss after 5 seconds.
 *   - Error toasts do NOT auto-dismiss; the user must close them.
 *   - Newest on top. At most 4 rendered; older ones fall off.
 *   - Top-right on desktop, bottom-center on mobile.
 */

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

type ToastContextValue = {
  show: (variant: ToastVariant, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());
    const autoDismissMs = variant === 'error' ? null : AUTO_DISMISS_MS;
    setToasts((prev) => [
      ...prev.slice(-(MAX_VISIBLE - 1)),
      { id, variant, title, description, autoDismissMs },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) => show('success', title, description),
      error: (title, description) => show('error', title, description),
      warning: (title, description) => show('warning', title, description),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-end gap-2 p-4 sm:inset-auto sm:right-0 sm:top-0 sm:max-w-sm"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full sm:w-80">
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
