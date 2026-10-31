'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormSection } from '../forms/form-section';
import { SidePanel } from '../layout/side-panel';
import { TextInput } from '../forms/text-input';
import { Button } from '../primitives/button';
import { useToast } from '../ui-states/toast-provider';
import { CurrencyAmount } from '../primitives/currency-amount';
import { useFormValidation, validateBaseAmount, validateRequired } from '@/lib/forms';
import { computeCommissionAmounts } from '@/lib/money/commission-math';
import { PLATFORM_FEE_RATE_BP } from '@/lib/config/commission';
import { watPeriod } from '@/lib/time';
import type { CommissionView } from '@/services/commission.service';

type Field = 'agentId' | 'coreCustomerId' | 'firstPaymentLocal' | 'baseAmount';

type AgentOption = {
  id: string;
  fullName: string;
  type: 'AGENT' | 'AMBASSADOR';
  region: string;
  commissionRate: number; // basis points
};

const CURRENCY = 'XAF' as const;

/**
 * The New commission form. Client component; form state, validation,
 * the live amount preview, and submission all live here.
 *
 * The server recomputes everything on submit — the preview is advisory
 * and matches the server's formulas exactly (both call
 * computeCommissionAmounts). If the agent's commissionRate changed
 * between page load and submit, the preview will be stale; the server
 * is authoritative.
 *
 * Period is display-only: derived from the first-payment date in WAT,
 * matching the server's derivation. The admin cannot override it.
 */
export function CommissionForm({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const toast = useToast();

  const initial = {
    agentId: '',
    coreCustomerId: '',
    firstPaymentLocal: defaultFirstPaymentLocal(),
    baseAmount: '',
  };

  const { values, visibleErrors, setField, touchField, validateAll } = useFormValidation<Field>({
    initial,
    validators: {
      agentId: (v) => validateRequired(v, 'Agent'),
      coreCustomerId: (v) => validateRequired(v, 'Customer ID'),
      firstPaymentLocal: (v) => validateRequired(v, 'First payment date'),
      baseAmount: validateBaseAmount,
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === values.agentId) ?? null;

  // Derived period in WAT from the local datetime string. Empty when the
  // date is missing or unparseable.
  const derivedPeriod = useMemo(() => {
    const iso = localToIso(values.firstPaymentLocal);
    if (!iso) return '';
    try {
      return watPeriod(new Date(iso));
    } catch {
      return '';
    }
  }, [values.firstPaymentLocal]);

  // Live preview of gross / fee / net. Only shown once both the agent and
  // a valid base amount are present.
  const preview = useMemo(() => {
    if (!selectedAgent) return null;
    const base = Number.parseInt(values.baseAmount, 10);
    if (!Number.isInteger(base) || base <= 0) return null;
    try {
      return computeCommissionAmounts(
        { amount: base, currency: CURRENCY },
        selectedAgent.commissionRate,
        PLATFORM_FEE_RATE_BP,
      );
    } catch {
      return null;
    }
  }, [selectedAgent, values.baseAmount]);

  const errorCount = Object.values(visibleErrors).filter(Boolean).length;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const ok = validateAll();
    if (!ok) return;

    const iso = localToIso(values.firstPaymentLocal);
    if (!iso) {
      setServerError('First payment date is invalid.');
      return;
    }

    const baseAmount = Number.parseInt(values.baseAmount, 10);
    if (!Number.isInteger(baseAmount) || baseAmount <= 0) {
      setServerError('Base amount must be a positive whole number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: values.agentId,
          coreCustomerId: values.coreCustomerId.trim(),
          firstPaymentConfirmedAt: iso,
          baseAmount: { amount: baseAmount, currency: CURRENCY },
        }),
      });

      const data = (await res.json()) as
        | { ok: true; data: CommissionView }
        | { ok: false; error: { code: string; message: string } };

      if (!data.ok) {
        setServerError(data.error.message);
        setSubmitting(false);
        return;
      }

      toast.success(
        'Commission created',
        `${data.data.period} · ${data.data.netAmount.amount} XAF net`,
      );
      // Until C.7 exists, go back to the ledger. In C.7 this becomes
      // `/admin/commissions/${data.data.id}`.
      router.replace('/admin/commissions');
      router.refresh();
    } catch {
      setServerError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

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

        <FormSection title="Commission">
          <div>
            <label htmlFor="agentId" className="block text-sm font-medium text-text-primary">
              Agent
            </label>
            <select
              id="agentId"
              value={values.agentId}
              onChange={(e) => setField('agentId', e.target.value)}
              onBlur={() => touchField('agentId')}
              className="focus-ring mt-1 block w-full rounded border border-border-default bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select an agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName} · {a.type === 'AGENT' ? 'Agent' : 'Ambassador'} · {a.region}
                </option>
              ))}
            </select>
            {visibleErrors.agentId && (
              <p className="mt-1 text-xs text-danger-fg">{visibleErrors.agentId}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="coreCustomerId"
              label="Customer ID"
              value={values.coreCustomerId}
              onChange={(e) => setField('coreCustomerId', e.target.value)}
              onBlur={() => touchField('coreCustomerId')}
              error={visibleErrors.coreCustomerId}
              helper="The customer's ID from the EpsiHome platform."
            />

            <div>
              <label
                htmlFor="derivedPeriod"
                className="block text-sm font-medium text-text-primary"
              >
                Period
              </label>
              <input
                id="derivedPeriod"
                type="text"
                value={derivedPeriod}
                readOnly
                disabled
                className="mt-1 block w-full cursor-not-allowed rounded border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-secondary"
                aria-describedby="derivedPeriod-helper"
              />
              <p id="derivedPeriod-helper" className="mt-1 text-xs text-text-tertiary">
                Derived from the first payment date, in WAT.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstPaymentLocal"
                className="block text-sm font-medium text-text-primary"
              >
                First payment confirmed
              </label>
              <input
                id="firstPaymentLocal"
                type="datetime-local"
                value={values.firstPaymentLocal}
                onChange={(e) => setField('firstPaymentLocal', e.target.value)}
                onBlur={() => touchField('firstPaymentLocal')}
                aria-invalid={Boolean(visibleErrors.firstPaymentLocal) || undefined}
                className={[
                  'focus-ring mt-1 block w-full rounded border bg-surface px-3 py-2 text-sm',
                  visibleErrors.firstPaymentLocal ? 'border-danger-fg' : 'border-border-default',
                ].join(' ')}
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Cameroon time (WAT). This is the date the customer&apos;s first payment was
                confirmed.
              </p>
              {visibleErrors.firstPaymentLocal && (
                <p className="mt-1 text-xs text-danger-fg">{visibleErrors.firstPaymentLocal}</p>
              )}
            </div>

            <div>
              <label htmlFor="baseAmount" className="block text-sm font-medium text-text-primary">
                Base amount
              </label>
              <div className="mt-1 flex items-stretch">
                <input
                  id="baseAmount"
                  type="text"
                  inputMode="numeric"
                  value={values.baseAmount}
                  onChange={(e) => setField('baseAmount', e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={() => touchField('baseAmount')}
                  aria-invalid={Boolean(visibleErrors.baseAmount) || undefined}
                  className={[
                    'focus-ring block w-full rounded-l border bg-surface px-3 py-2 text-sm',
                    visibleErrors.baseAmount ? 'border-danger-fg' : 'border-border-default',
                  ].join(' ')}
                  placeholder="e.g. 20000"
                />
                <span className="inline-flex items-center rounded-r border border-l-0 border-border-default bg-surface-muted px-3 text-sm text-text-secondary">
                  XAF
                </span>
              </div>
              <p className="mt-1 text-xs text-text-tertiary">The customer&apos;s first payment.</p>
              {visibleErrors.baseAmount && (
                <p className="mt-1 text-xs text-danger-fg">{visibleErrors.baseAmount}</p>
              )}
            </div>
          </div>
        </FormSection>

        {preview && (
          <section className="rounded border border-border-default bg-surface-muted p-5">
            <h2 className="text-base font-semibold text-text-primary">
              How the amount is worked out
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Base amount">
                <CurrencyAmount value={{ amount: Number(values.baseAmount), currency: CURRENCY }} />
              </Row>
              <Row label="Rate applied">
                <span className="amount">{(selectedAgent!.commissionRate / 100).toFixed(2)}%</span>
              </Row>
              <Row label="Gross commission">
                <CurrencyAmount value={preview.grossAmount} />
              </Row>
              <Row label={`Platform fee · ${(PLATFORM_FEE_RATE_BP / 100).toFixed(2)}% of gross`}>
                <span className="amount text-text-secondary">
                  −<CurrencyAmount value={preview.platformFee} />
                </span>
              </Row>
              <div className="mt-3 flex items-baseline justify-between border-t border-border-default pt-3">
                <dt className="font-medium text-text-primary">Net to agent</dt>
                <dd>
                  <CurrencyAmount value={preview.netAmount} className="text-lg font-semibold" />
                </dd>
              </div>
            </dl>
          </section>
        )}

        <div className="rounded border border-info-fg/30 bg-info-bg px-4 py-3 text-sm text-info-fg">
          Created as Pending. It must be verified and then approved before it can go into a payout
          batch.
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel="Creating…">
            Create commission
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <SidePanel title="When you create">
          <ul className="list-disc space-y-2 pl-5">
            <li>The commission starts as Pending.</li>
            <li>
              The period is derived from the first payment date in WAT — an admin cannot set it
              independently.
            </li>
            <li>
              The agent&apos;s rate is snapshotted now. Changing their rate later does not affect
              this commission.
            </li>
            <li>
              One commission per (agent, customer, period). A duplicate is rejected with a clear
              message.
            </li>
            <li>The exact amounts are confirmed by the server when you submit.</li>
          </ul>
        </SidePanel>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * A datetime-local input gives us a string like "2026-09-28T10:15"
 * with no timezone. That string IS the WAT wall clock, so we append
 * the WAT offset (+01:00) before constructing a Date. This is the
 * only place WAT conversion happens on the client; the server re-derives
 * the period from the ISO we send.
 */
function localToIso(local: string): string | null {
  if (!local) return null;
  // Basic shape check. The browser won't produce anything else, but
  // be defensive in case of paste or scripted input.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return null;
  // Trim seconds if present, keep minutes.
  const trimmed = local.length > 16 ? local.slice(0, 16) : local;
  const iso = `${trimmed}:00+01:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Default first-payment value: now, in WAT, formatted for a
 * datetime-local input. Gives the admin a starting point (most
 * commissions are recorded shortly after the payment) without
 * guessing a wrong value.
 */
function defaultFirstPaymentLocal(): string {
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000); // shift to WAT
  const y = wat.getUTCFullYear();
  const m = String(wat.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wat.getUTCDate()).padStart(2, '0');
  const hh = String(wat.getUTCHours()).padStart(2, '0');
  const mm = String(wat.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
