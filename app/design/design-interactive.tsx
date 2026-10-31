'use client';

import { useState } from 'react';
import { Dialog, Button, useToast } from '@/components';

export function DesignInteractives() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const toast = useToast();

  return (
    <>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Dialog</h2>
        <div className="mt-4">
          <Button variant="danger" onClick={() => setDialogOpen(true)}>
            Open reverse dialog
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Reverse commission CM-9D41F0"
          destructive
          confirmLabel="Reverse commission"
          confirmToken="CM-9D41F0"
          onConfirm={async () => {
            await new Promise((r) => setTimeout(r, 300));
            setDialogOpen(false);
            toast.success('Commission reversed', 'A mirror row was created.');
          }}
        >
          <p>
            This creates a mirror commission of −9,500 XAF for the same customer and period. The
            original row stays unchanged. This cannot be undone.
          </p>
        </Dialog>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Toasts</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => toast.success('Saved')}>
            Success toast
          </Button>
          <Button
            variant="danger"
            onClick={() => toast.error('Not saved', 'Another admin changed this record.')}
          >
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => toast.warning('Heads up')}>
            Warning toast
          </Button>
        </div>
      </section>
    </>
  );
}
