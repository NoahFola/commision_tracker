'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useFormValidation,
  validateEmail,
  validatePhone,
  validateReferralCode,
  validateRequired,
  validatePassword,
} from '@/lib/forms';
import type { AgentType, PayoutMethod } from '@/models/agent.model';
import type { AgentDetail } from '@/types/agent';
import { useToast } from '../ui-states/toast-provider';
import { FormSection } from '../forms/form-section';
import { TextInput } from '../forms/text-input';
import { FilterSegmented } from '../primitives/filter-segmented';
import { PasswordInput } from '../forms/password-input';
import { Button } from '../primitives/button';
import { SidePanel } from '../layout/side-panel';

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
];

type Field =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'referralCode'
  | 'password'
  | 'regionId'
  | 'type'
  | 'payoutMethod'
  | 'payoutProvider'
  | 'payoutAccountNumber'
  | 'payoutAccountName';

type Mode = 'create' | 'edit';

/**
 * The new/edit agent form. Reused by /admin/agents/new and
 * /admin/agents/[id]/edit.
 *
 * Client component: form state, validation, and submission all live
 * here. The page provides the initial values and the regions list.
 */
export function AgentForm({
  mode,
  agentId,
  regions,
  initialValues,
}: {
  mode: Mode;
  agentId?: string;
  regions: { id: string; name: string }[];
  initialValues?: Partial<{
    fullName: string;
    email: string;
    phone: string;
    referralCode: string;
    regionId: string;
    type: AgentType;
    status: string;
    onboardingStage: string;
    payoutMethod: PayoutMethod;
    payoutProvider: string;
    payoutAccountNumber: string;
    payoutAccountName: string;
  }>;
}) {
  const router = useRouter();
  const toast = useToast();

  const initial = {
    fullName: initialValues?.fullName ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    referralCode: initialValues?.referralCode ?? '',
    password: '',
    regionId: initialValues?.regionId ?? '',
    type: initialValues?.type ?? ('AGENT' as AgentType),
    payoutMethod: initialValues?.payoutMethod ?? ('MOBILE_MONEY' as PayoutMethod),
    payoutProvider: initialValues?.payoutProvider ?? '',
    payoutAccountNumber: initialValues?.payoutAccountNumber ?? '',
    payoutAccountName: initialValues?.payoutAccountName ?? '',
  };

  const { values, visibleErrors, setField, touchField, validateAll, setError } =
    useFormValidation<Field>({
      initial,
      validators: {
        fullName: (v) => validateRequired(v, 'Full name'),
        email: validateEmail,
        phone: validatePhone,
        referralCode: validateReferralCode,
        password: mode === 'create' ? validatePassword : () => null, // not required in edit mode
        regionId: (v) => validateRequired(v, 'Region'),
      },
    });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errorCount = Object.values(visibleErrors).filter(Boolean).length;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const ok = validateAll();
    if (!ok) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fullName: values.fullName,
        type: values.type,
        email: values.email,
        phone: values.phone,
        regionId: values.regionId,
        referralCode: values.referralCode,
        payoutPreference: {
          method: values.payoutMethod,
          provider: values.payoutProvider || undefined,
          accountNumber: values.payoutAccountNumber || undefined,
          accountName: values.payoutAccountName || undefined,
        },
      };

      if (mode === 'create') body.password = values.password;

      const url = mode === 'create' ? '/api/agents' : `/api/agents/${agentId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as
        { ok: true; data: AgentDetail } | { ok: false; error: { code: string; message: string } };

      if (!data.ok) {
        // Server-side error. Surface it as a banner. Common cases:
        // unique-constraint collisions that we couldn't check
        // client-side (email, phone, referral code already in use).
        setServerError(data.error.message);
        setSubmitting(false);
        return;
      }

      if (mode === 'create') {
        // Navigate to the new agent's detail page. The detail page
        // (C.4) will render with the freshly created agent.
        router.replace(`/admin/agents/${data.data.id}`);
        router.refresh();
      } else {
        toast.success('Changes saved');
        setSubmitting(false);
        router.refresh();
      }
    } catch {
      setServerError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  const isCreate = mode === 'create';

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {serverError && (
          <div className="rounded border border-danger-fg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            {serverError}
          </div>
        )}
        {errorCount > 0 && (
          <div className="rounded border border-danger-fg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            {errorCount} field{errorCount === 1 ? '' : 's'} need
            {errorCount === 1 ? 's' : ''} fixing. Nothing was saved.
          </div>
        )}

        <FormSection title="Identity">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="fullName"
              label="Full name"
              value={values.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              onBlur={() => touchField('fullName')}
              error={visibleErrors.fullName}
            />
            <div>
              <label className="block text-sm font-medium text-text-primary">Type</label>
              <div className="mt-1">
                <FilterSegmented
                  name="type"
                  value={values.type}
                  onChange={(v) => setField('type', v || 'AGENT')}
                  options={[
                    { value: 'AGENT', label: 'Agent' },
                    { value: 'AMBASSADOR', label: 'Ambassador' },
                  ]}
                />
              </div>
              {!isCreate && (
                <p className="mt-1 text-xs text-text-tertiary">
                  Cannot be changed after the agent is created.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="regionId" className="block text-sm font-medium text-text-primary">
                Region
              </label>
              <select
                id="regionId"
                value={values.regionId}
                onChange={(e) => setField('regionId', e.target.value)}
                onBlur={() => touchField('regionId')}
                className="focus-ring mt-1 block w-full rounded border border-border-default bg-surface px-3 py-2 text-sm"
              >
                <option value="">Select a region</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {visibleErrors.regionId && (
                <p className="mt-1 text-xs text-danger-fg">{visibleErrors.regionId}</p>
              )}
            </div>
            <TextInput
              name="referralCode"
              label="Referral code"
              value={values.referralCode}
              onChange={(e) => setField('referralCode', e.target.value)}
              onBlur={() => touchField('referralCode')}
              error={visibleErrors.referralCode}
              helper="Must be unique. The agent gives this code to customers."
            />
          </div>
        </FormSection>

        <FormSection
          title="Contact and sign-in"
          description={
            isCreate
              ? 'The agent signs in with this email and the temporary password.'
              : 'Editing the password is a separate action.'
          }
        >
          <TextInput
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            onBlur={() => touchField('email')}
            error={visibleErrors.email}
          />
          <TextInput
            name="phone"
            type="tel"
            label="Phone"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => setField('phone', e.target.value)}
            onBlur={() => touchField('phone')}
            error={visibleErrors.phone}
          />
          {isCreate && (
            <PasswordInput
              name="password"
              label="Temporary password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => setField('password', e.target.value)}
              onBlur={() => touchField('password')}
              error={visibleErrors.password}
              helper="Share it with the agent directly. There is no self-service reset yet."
            />
          )}
        </FormSection>

        <FormSection
          title="Payout preference"
          description="Used as the default method when a payout batch is created. The agent can change it later."
        >
          <div>
            <label className="block text-sm font-medium text-text-primary">Method</label>
            <div className="mt-1">
              <FilterSegmented
                name="payoutMethod"
                value={values.payoutMethod}
                onChange={(v) => setField('payoutMethod', v || 'MOBILE_MONEY')}
                options={PAYOUT_METHODS}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextInput
              name="payoutProvider"
              label="Provider"
              value={values.payoutProvider}
              onChange={(e) => setField('payoutProvider', e.target.value)}
              placeholder="MTN MoMo, Orange Money, …"
            />
            <TextInput
              name="payoutAccountNumber"
              label="Account number"
              value={values.payoutAccountNumber}
              onChange={(e) => setField('payoutAccountNumber', e.target.value)}
            />
            <TextInput
              name="payoutAccountName"
              label="Account name"
              value={values.payoutAccountName}
              onChange={(e) => setField('payoutAccountName', e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          title="Starting status"
          description="Set automatically. Change them later from the agent profile."
        >
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-text-secondary">Status </span>
              <span className="font-medium">{initialValues?.status ?? 'ACTIVE'}</span>
            </div>
            <div>
              <span className="text-text-secondary">Onboarding stage </span>
              <span className="font-medium">
                {initialValues?.onboardingStage ?? 'Registered · step 1 of 4'}
              </span>
            </div>
          </div>
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel="Saving…">
            {isCreate ? 'Create agent' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <SidePanel title={isCreate ? 'When you create' : 'Editing an agent'}>
          {isCreate ? (
            <ul className="list-disc space-y-2 pl-5">
              <li>The agent can sign in straight away with the email and temporary password.</li>
              <li>Status starts as Active and onboarding as Registered.</li>
              <li>Email, phone and referral code must not already be in use.</li>
              <li>The creation is recorded in the audit history with your name and the time.</li>
            </ul>
          ) : (
            <p>
              This is the same form as New agent. Type and password cannot be changed from here.
              Status and onboarding stage are changed from the agent profile, one step at a time.
            </p>
          )}
        </SidePanel>
      </div>
    </form>
  );
}
