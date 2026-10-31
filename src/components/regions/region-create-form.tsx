'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { FormSection } from '../forms/form-section';
import { TextInput } from '../forms/text-input';
import { useToast } from '../ui-states/toast-provider';
import { useFormValidation, validateRequired } from '@/lib/forms';

type Field = 'name' | 'code';

export function RegionCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { values, visibleErrors, setField, touchField, validateAll } =
    useFormValidation<Field>({
      initial: { name: '', code: '' },
      validators: {
        name: (v) => validateRequired(v, 'Name'),
      },
    });

  const errorCount = Object.values(visibleErrors).filter(Boolean).length;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    if (!validateAll()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/regions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          code: values.code.trim() || undefined,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; data: unknown }
        | { ok: false; error: { message: string } };

      if (!data.ok) {
        setServerError(data.error.message);
        setSubmitting(false);
        return;
      }

      toast.success('Region created');
      setField('name', '');
      setField('code', '');
      router.refresh();
    } catch {
      setServerError('Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {serverError && (
        <div className="rounded border border-danger-fg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {serverError}
        </div>
      )}
      {errorCount > 0 && (
        <div className="rounded border border-danger-fg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {errorCount} field{errorCount === 1 ? '' : 's'} need
          {errorCount === 1 ? 's' : ''} fixing.
        </div>
      )}

      <FormSection title="Add a region">
        <TextInput
          name="name"
          label="Name"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          onBlur={() => touchField('name')}
          error={visibleErrors.name}
          helper="Unique, case-insensitively."
        />
        <TextInput
          name="code"
          label="Code (optional)"
          value={values.code}
          onChange={(e) => setField('code', e.target.value.toUpperCase())}
          helper="Short label like DLA. Uppercased automatically."
        />

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={submitting} loadingLabel="Saving…">
            Create region
          </Button>
        </div>
      </FormSection>
    </form>
  );
}