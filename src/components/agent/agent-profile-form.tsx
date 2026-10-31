'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { TextInput } from '../forms/text-input';
import { useToast } from '../ui-states/toast-provider';
import { useFormValidation, validatePhone } from '@/lib/forms';

type PayoutMethod = 'MOBILE_MONEY' | 'BANK' | 'CASH';

export function AgentProfileForm({
  initialPhone,
  initialPayoutPreference,
}: {
  initialPhone: string;
  initialPayoutPreference: {
    method: PayoutMethod;
    provider: string;
    accountNumber: string;
    accountName: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { values, visibleErrors, setField, touchField, validateAll } = useFormValidation({
    initial: {
      phone: initialPhone,
      method: initialPayoutPreference.method,
      provider: initialPayoutPreference.provider,
      accountNumber: initialPayoutPreference.accountNumber,
      accountName: initialPayoutPreference.accountName,
    },
    validators: {
      phone: validatePhone,
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validateAll()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/agents/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: values.phone,
          payoutPreference: {
            method: values.method,
            provider: values.provider || undefined,
            accountNumber: values.accountNumber || undefined,
            accountName: values.accountName || undefined,
          },
        }),
      });
      const data = (await res.json()) as { ok: true } | { ok: false; error: { message: string } };

      if (!data.ok) {
        setError(data.error.message);
        setSubmitting(false);
        return;
      }

      toast.success('Profile updated');
      setSubmitting(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border-default bg-surface p-5"
    >
      <h2 className="text-base font-semibold">You can change</h2>

      <TextInput
        name="phone"
        label="Phone"
        type="tel"
        value={values.phone}
        onChange={(e) => setField('phone', e.target.value)}
        onBlur={() => touchField('phone')}
        error={visibleErrors.phone}
      />

      <div>
        <p className="text-sm font-medium text-text-primary">How you are paid</p>
        <div className="mt-1 inline-flex rounded border border-border-default bg-surface p-0.5">
          {(['MOBILE_MONEY', 'BANK', 'CASH'] as PayoutMethod[]).map((m) => {
            const active = values.method === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setField('method', m)}
                className={[
                  'focus-ring rounded px-3 py-1.5 text-sm',
                  active ? 'bg-success-bg font-medium text-success-fg' : 'text-text-secondary',
                ].join(' ')}
              >
                {m === 'MOBILE_MONEY' ? 'Mobile money' : m === 'BANK' ? 'Bank' : 'Cash'}
              </button>
            );
          })}
        </div>
      </div>

      {values.method !== 'CASH' && (
        <>
          <TextInput
            name="provider"
            label="Provider"
            value={values.provider}
            onChange={(e) => setField('provider', e.target.value)}
            helper="e.g. MTN MoMo, Orange Money."
          />
          <TextInput
            name="accountNumber"
            label="Account number"
            value={values.accountNumber}
            onChange={(e) => setField('accountNumber', e.target.value)}
          />
          <TextInput
            name="accountName"
            label="Account name"
            value={values.accountName}
            onChange={(e) => setField('accountName', e.target.value)}
          />
        </>
      )}

      <div className="rounded border border-info-fg/30 bg-info-bg px-3 py-2 text-xs text-info-fg">
        Your next payout uses these details. Check the number before you save.
      </div>

      {error && (
        <div className="rounded border border-danger-fg bg-danger-bg px-3 py-2 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" loading={submitting} loadingLabel="Saving…">
        Save changes
      </Button>
    </form>
  );
}
