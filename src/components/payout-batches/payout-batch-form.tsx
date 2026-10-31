'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../primitives/button';
import { ButtonLink } from '../primitives/button';
import { CurrencyAmount } from '../primitives/currency-amount';
import { FormSection } from '../forms/form-section';
import { SidePanel } from '../layout/side-panel';
import { TextInput } from '../forms/text-input';
import { useToast } from '../ui-states/toast-provider';
import { useFormValidation, validateRequired } from '@/lib/forms';
import type { AgentDetail } from '@/types/agent';
import type { CommissionView } from '@/services/commission.service';
import type { PayoutBatchView } from '@/services/payout-batch.service';

type AgentOption = {
  id: string;
  fullName: string;
  type: 'AGENT' | 'AMBASSADOR';
  region: string;
};

type Field = 'agentId' | 'period' | 'method';

const MINIMUM_BATCH_AMOUNT_XAF = 5000;

const PAYOUT_METHODS = [
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
] as const;

type PayoutMethod = (typeof PAYOUT_METHODS)[number]['value'];

/**
 * The New payout batch form.
 *
 * The server picks the eligible commissions at create time; this form
 * shows the admin a preview of what will be included and lets them
 * choose the payout method. The preview is advisory — the server is
 * authoritative.
 *
 * Agent detail (for the method default) is fetched on selection. The
 * preview (approved commissions and existing batches) is fetched on
 * (agent, period) change.
 */
export function PayoutBatchForm({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const toast = useToast();

  const initial = {
    agentId: '',
    period: defaultWATPeriod(),
    method: '' as PayoutMethod | '',
  };

  const { values, visibleErrors, setField, touchField, validateAll } = useFormValidation<Field>({
    initial,
    validators: {
      agentId: (v) => validateRequired(v, 'Agent'),
      period: (v) => {
        if (!v) return 'Period is required.';
        if (!/^\d{4}-\d{2}$/.test(v)) return 'Period must look like 2026-09.';
        return null;
      },
    },
  });

  // Agent detail (default method, provider, account number).
  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [agentDetailLoading, setAgentDetailLoading] = useState(false);
  const [agentDetailError, setAgentDetailError] = useState<string | null>(null);

  // Preview (approved commissions, total, existing batch).
  const [approvedCommissions, setApprovedCommissions] = useState<CommissionView[] | null>(null);
  const [existingBatch, setExistingBatch] = useState<PayoutBatchView | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // --- Effect 1: fetch agent detail when the agent changes -------------
  useEffect(() => {
    if (!values.agentId) {
      setAgentDetail(null);
      setAgentDetailError(null);
      return;
    }
    let cancelled = false;
    setAgentDetailLoading(true);
    setAgentDetailError(null);
    fetch(`/api/agents/${values.agentId}`)
      .then(async (res) => {
        if (cancelled) return;
        const body = (await res.json()) as
          { ok: true; data: AgentDetail } | { ok: false; error: { message: string } };
        if (body.ok) {
          setAgentDetail(body.data);
          // If the method field is empty, populate it from the agent's
          // default. Don't override an explicit choice.
          if (!values.method) {
            setField('method', body.data.payoutPreference.method);
          }
        } else {
          setAgentDetailError(body.error.message);
        }
      })
      .catch(() => {
        if (!cancelled) setAgentDetailError('Could not load agent details.');
      })
      .finally(() => {
        if (!cancelled) setAgentDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.agentId]);

  // --- Effect 2: fetch preview when agent or period changes -----------
  useEffect(() => {
    if (!values.agentId || !/^\d{4}-\d{2}$/.test(values.period)) {
      setApprovedCommissions(null);
      setExistingBatch(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    const commissionsUrl = `/api/commissions?agentId=${values.agentId}&period=${values.period}&status=APPROVED&limit=50`;
    const batchesUrl = `/api/payout-batches?agentId=${values.agentId}&period=${values.period}&limit=10`;

    Promise.all([
      fetch(commissionsUrl).then((r) => r.json()),
      fetch(batchesUrl).then((r) => r.json()),
    ])
      .then(
        ([commissionsBody, batchesBody]: [
          (
            | { ok: true; data: { items: CommissionView[] } }
            | { ok: false; error: { message: string } }
          ),
          (
            | { ok: true; data: { items: PayoutBatchView[] } }
            | { ok: false; error: { message: string } }
          ),
        ]) => {
          if (cancelled) return;
          if (!commissionsBody.ok) {
            setPreviewError(commissionsBody.error.message);
            return;
          }
          if (!batchesBody.ok) {
            setPreviewError(batchesBody.error.message);
            return;
          }
          setApprovedCommissions(commissionsBody.data.items);
          const blocking = batchesBody.data.items.find(
            (b) => b.status !== 'FAILED' && b.status !== 'PAID',
          );
          setExistingBatch(blocking ?? null);
        },
      )
      .catch(() => {
        if (!cancelled) setPreviewError('Could not load the preview.');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [values.agentId, values.period]);

  const previewTotal = useMemo(() => {
    if (!approvedCommissions) return 0;
    return approvedCommissions.reduce((s, c) => s + c.netAmount.amount, 0);
  }, [approvedCommissions]);

  const belowMinimum = previewTotal > 0 && previewTotal < MINIMUM_BATCH_AMOUNT_XAF;
  const meetsMinimum = previewTotal >= MINIMUM_BATCH_AMOUNT_XAF;
  const canSubmit =
    !submitting &&
    Boolean(values.agentId && values.period && values.method) &&
    !existingBatch &&
    meetsMinimum &&
    !previewLoading &&
    !agentDetailLoading &&
    !previewError;

  const errorCount = Object.values(visibleErrors).filter(Boolean).length;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const ok = validateAll();
    if (!ok) return;
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/payout-batches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: values.agentId,
          period: values.period,
          method: values.method,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; data: PayoutBatchView }
        | { ok: false; error: { code: string; message: string } };

      if (!data.ok) {
        setServerError(data.error.message);
        setSubmitting(false);
        return;
      }

      toast.success('Batch created', 'Draft; approve it to send the transfer.');
      router.replace('/admin/payout-batches');
      router.refresh();
    } catch {
      setServerError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  const selectedAgent = agents.find((a) => a.id === values.agentId);
  const methodDisplay = (() => {
    if (!agentDetail) return 'Select an agent first';
    const m = agentDetail.payoutPreference.method;
    const label = m === 'MOBILE_MONEY' ? 'Mobile money' : m === 'BANK' ? 'Bank transfer' : 'Cash';
    const parts = [label];
    if (agentDetail.payoutPreference.provider) parts.push(agentDetail.payoutPreference.provider);
    if (agentDetail.payoutPreference.accountNumber)
      parts.push(agentDetail.payoutPreference.accountNumber);
    return parts.join(' · ');
  })();

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

        <FormSection title="Batch">
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
            <div>
              <label htmlFor="period" className="block text-sm font-medium text-text-primary">
                Period
              </label>
              <input
                id="period"
                type="month"
                value={values.period}
                onChange={(e) => setField('period', e.target.value)}
                onBlur={() => touchField('period')}
                className="focus-ring mt-1 block w-full rounded border border-border-default bg-surface px-3 py-2 text-sm"
              />
              {visibleErrors.period && (
                <p className="mt-1 text-xs text-danger-fg">{visibleErrors.period}</p>
              )}
            </div>

            <div>
              <label htmlFor="method" className="block text-sm font-medium text-text-primary">
                Method
              </label>
              <select
                id="method"
                value={values.method}
                onChange={(e) => setField('method', e.target.value as PayoutMethod)}
                className="focus-ring mt-1 block w-full rounded border border-border-default bg-surface px-3 py-2 text-sm"
                disabled={!agentDetail || agentDetailLoading}
              >
                <option value="">{methodDisplay}</option>
                {PAYOUT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-tertiary">
                The agent&apos;s default payout preference. Change it only if this payout goes
                another way.
              </p>
              {agentDetailError && (
                <p className="mt-1 text-xs text-danger-fg">{agentDetailError}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Preview panel */}
        {values.agentId && /^\d{4}-\d{2}$/.test(values.period) && (
          <section className="rounded border border-border-default bg-surface p-5">
            <h2 className="text-base font-semibold">Approved commissions that will be added</h2>

            {previewLoading && <p className="mt-3 text-sm text-text-secondary">Loading…</p>}

            {previewError && (
              <p className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-sm text-danger-fg">
                {previewError}
              </p>
            )}

            {!previewLoading && !previewError && existingBatch && (
              <div className="mt-3 rounded border border-danger-fg bg-danger-bg px-3 py-2 text-sm text-danger-fg">
                A batch already exists for {selectedAgent?.fullName} for {values.period}:{' '}
                {existingBatch.id.slice(-4).toUpperCase()}, {existingBatch.status}.{' '}
                <ButtonLink
                  href={`/admin/payout-batches/${existingBatch.id}`}
                  variant="secondary"
                  size="small"
                >
                  Open {existingBatch.id.slice(-4).toUpperCase()}
                </ButtonLink>
              </div>
            )}

            {!previewLoading && !previewError && !existingBatch && approvedCommissions && (
              <>
                {approvedCommissions.length === 0 ? (
                  <p className="mt-3 text-sm text-text-secondary">
                    No APPROVED commissions for this agent and period.
                  </p>
                ) : (
                  <>
                    <ul className="mt-3 space-y-2 text-sm">
                      {approvedCommissions.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs">{shortId(c.id)}</span>
                          <span className="text-xs text-text-secondary">{c.coreCustomerId}</span>
                          <CurrencyAmount value={c.netAmount} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-baseline justify-between border-t border-border-default pt-3 text-sm">
                      <span className="text-text-secondary">
                        Batch total · {approvedCommissions.length} commission
                        {approvedCommissions.length === 1 ? '' : 's'}
                      </span>
                      <CurrencyAmount
                        value={{ amount: previewTotal, currency: 'XAF' }}
                        className="font-semibold"
                      />
                    </div>
                  </>
                )}

                {meetsMinimum && (
                  <div className="mt-3 rounded border border-success-fg/30 bg-success-bg px-3 py-2 text-sm text-success-fg">
                    ✓ {previewTotal.toLocaleString('en-US')} XAF is above the 5,000 XAF minimum.
                  </div>
                )}
                {belowMinimum && (
                  <div className="mt-3 rounded border border-warning-fg/30 bg-warning-bg px-3 py-2 text-sm text-warning-fg">
                    ⚠ {previewTotal.toLocaleString('en-US')} XAF is below the 5,000 XAF minimum.{' '}
                    {selectedAgent?.fullName} needs{' '}
                    {(MINIMUM_BATCH_AMOUNT_XAF - previewTotal).toLocaleString('en-US')} XAF more in
                    approved commissions before a batch can be created.
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <p className="text-sm text-text-secondary">
          Created as Draft. Nothing is paid until the batch is approved, sent and marked as paid.
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            loadingLabel="Creating…"
            disabled={!canSubmit}
          >
            Create batch
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <SidePanel title="When you create">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The batch includes every APPROVED commission for this agent and period that is not
              already in a batch.
            </li>
            <li>The total must be at least 5,000 XAF. It is checked again at approval.</li>
            <li>Each commission&apos;s payout batch id is set atomically; nothing else changes.</li>
            <li>The batch starts as Draft. Approval freezes the total.</li>
          </ul>
        </SidePanel>
      </div>
    </form>
  );
}

function shortId(id: string): string {
  return `CM-${id.slice(-6).toUpperCase()}`;
}

function defaultWATPeriod(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
