'use client';

import { useState } from 'react';

type PayoutMethod = 'MOBILE_MONEY' | 'BANK' | 'CASH';

export function ProfileForm({
  initialPhone,
  initialPayoutPreference,
  initialProfilePictureUrl,
}: {
  initialPhone: string;
  initialPayoutPreference: {
    method: PayoutMethod;
    provider: string;
    accountNumber: string;
    accountName: string;
  };
  initialProfilePictureUrl: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [method, setMethod] = useState<PayoutMethod>(initialPayoutPreference.method);
  const [provider, setProvider] = useState(initialPayoutPreference.provider);
  const [accountNumber, setAccountNumber] = useState(initialPayoutPreference.accountNumber);
  const [accountName, setAccountName] = useState(initialPayoutPreference.accountName);
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialProfilePictureUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/agents/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone,
          payoutPreference: {
            method,
            provider: provider || undefined,
            accountNumber: accountNumber || undefined,
            accountName: accountName || undefined,
          },
          profilePictureUrl: profilePictureUrl || null,
        }),
      });
      const body = await res.json();
      if (body.ok) {
        setMessage({ kind: 'ok', text: 'Saved' });
      } else {
        setMessage({
          kind: 'error',
          text: body.error?.message ?? 'Could not save. Try again.',
        });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded border border-neutral/30 bg-background px-3 py-2 text-base"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Payout preference</legend>
        <div>
          <label htmlFor="method" className="block text-xs text-neutral">
            Method
          </label>
          <select
            id="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PayoutMethod)}
            className="mt-1 w-full rounded border border-neutral/30 bg-background px-3 py-2 text-base"
          >
            <option value="MOBILE_MONEY">Mobile money</option>
            <option value="BANK">Bank transfer</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
        <div>
          <label htmlFor="provider" className="block text-xs text-neutral">
            Provider
          </label>
          <input
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="MTN MoMo, Orange Money, …"
            className="mt-1 w-full rounded border border-neutral/30 bg-background px-3 py-2 text-base"
          />
        </div>
        <div>
          <label htmlFor="accountNumber" className="block text-xs text-neutral">
            Account number
          </label>
          <input
            id="accountNumber"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="mt-1 w-full rounded border border-neutral/30 bg-background px-3 py-2 text-base"
          />
        </div>
        <div>
          <label htmlFor="accountName" className="block text-xs text-neutral">
            Account name
          </label>
          <input
            id="accountName"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="mt-1 w-full rounded border border-neutral/30 bg-background px-3 py-2 text-base"
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="profilePictureUrl" className="block text-sm font-medium">
          Profile picture URL
        </label>
        <input
          id="profilePictureUrl"
          type="url"
          value={profilePictureUrl}
          onChange={(e) => setProfilePictureUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded border border-neutral/30 bg-background px-3 py-2 text-base"
        />
      </div>

      {message && (
        <p
          role="status"
          className={`text-sm ${message.kind === 'ok' ? 'text-success' : 'text-danger'}`}
        >
          {message.text}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
