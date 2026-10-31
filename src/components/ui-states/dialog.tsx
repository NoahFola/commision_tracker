'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../primitives/button';
import { TextInput } from '../forms/text-input';

/**
 * Modal dialog built on the native <dialog> element.
 *
 * The native element handles focus trapping, Escape, and the backdrop
 * for free. This component adds:
 *   - Controlled open/close (via the `open` and `onClose` props)
 *   - An optional typed-confirmation pattern
 *   - A destructive flag that colours the primary action red
 *
 * Usage:
 *
 *   <Dialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     title="Reverse commission CM-9D41F0"
 *     confirmLabel="Reverse commission"
 *     destructive
 *     confirmToken="CM-9D41F0"
 *     onConfirm={async () => { await reverse(); setOpen(false); }}
 *   >
 *     <p>This creates a mirror commission of −9,500 XAF…</p>
 *   </Dialog>
 */

export function Dialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  confirmToken,
  destructive = false,
  persistent = false,
  confirmDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** When present, the user must type exactly this string to confirm. */
  confirmToken?: string;
  destructive?: boolean;
  /** When true, backdrop-click and Escape do not dismiss. */
  persistent?: boolean;
  confirmDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setTyped('');
      setError(null);
      setBusy(false);
      el.showModal();
      // Native <dialog> focuses the first focusable descendant, but some
      // browsers focus the dialog itself. Explicitly focus the first
      // interactive element so keyboard users land inside the dialog.
      queueMicrotask(() => {
        const first = el.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      });
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => {
      e.preventDefault();
      if (persistent || busy) return;
      onClose();
    };
    el.addEventListener('cancel', handler);
    return () => el.removeEventListener('cancel', handler);
  }, [onClose, persistent, busy]);

  const confirmReady = !confirmToken || typed === confirmToken;

  async function handleConfirm() {
    if (!confirmReady || busy || confirmDisabled) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
    if (persistent || busy) return;
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClick={handleBackdrop}
      className="m-auto w-[min(92vw,480px)] rounded-lg border border-border-default bg-surface p-0 shadow-lg backdrop:bg-black/30"
    >
      <div className="px-5 py-4">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>

        <div className="mt-3 text-sm text-text-secondary">{children}</div>

        {confirmToken && (
          <div className="mt-4">
            <TextInput
              name="confirm"
              label={`Type ${confirmToken} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        {error && <p className="mt-3 text-xs text-danger-fg">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={!confirmReady || confirmDisabled}
            loading={busy}
            loadingLabel="Working…"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
