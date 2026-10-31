import { notFound } from 'next/navigation';
import { requireSessionUser } from '@/lib/auth/session-server';
import {
  AgentStatusBadge,
  CommissionStatusBadge,
  BatchStatusBadge,
  ReversalBadge,
  CurrencyAmount,
  DateTime,
  ActorAttribution,
  CopyButton,
  TextInput,
  ButtonLink,
  Button,
  FilterPeriod,
  FilterSelect,
  FilterSearch,
  FilterBar,
  TableShell,
} from '@/components';
import { DesignInteractives } from './design-interactive';
import { OnboardingStageIndicator } from '@/components/onboarding-stage-indicator';

/**
 * Design reference. Renders every primitive so we can look at it in
 * isolation and confirm the palette.
 *
 * Admin-only. Non-admin sessions get a 404 — the page isn't user-facing.
 */
export default async function DesignPage() {
  const user = await requireSessionUser();
  if (user.subjectType !== 'ADMIN') notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Design reference</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Admin only. Renders the palette and primitives.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Agent statuses</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <AgentStatusBadge status="ACTIVE" />
          <AgentStatusBadge status="SUSPENDED" />
          <AgentStatusBadge status="INACTIVE" />
          <AgentStatusBadge status="TERMINATED" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Commission statuses</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <CommissionStatusBadge status="PENDING" />
          <CommissionStatusBadge status="VERIFIED" />
          <CommissionStatusBadge status="APPROVED" />
          <CommissionStatusBadge status="PAID" />
          <ReversalBadge />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Batch statuses</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <BatchStatusBadge status="DRAFT" />
          <BatchStatusBadge status="APPROVED" />
          <BatchStatusBadge status="PROCESSING" />
          <BatchStatusBadge status="PAID" />
          <BatchStatusBadge status="FAILED" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Currency amount</h2>
        <div className="mt-4 space-y-2">
          <CurrencyAmount value={{ amount: 15675, currency: 'XAF' }} />
          <CurrencyAmount
            value={{ amount: 1216000, currency: 'XAF' }}
            className="text-2xl font-semibold"
          />
          <CurrencyAmount value={{ amount: -9500, currency: 'XAF' }} signed />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Date and time</h2>
        <div className="mt-4 space-y-2">
          <DateTime value="2026-09-30T14:23:00.000Z" variant="date" />
          <DateTime value="2026-09-30T14:23:00.000Z" variant="time" />
          <DateTime value="2026-09-30T14:23:00.000Z" variant="datetime" />
          <DateTime value="2026-09-30T14:23:00.000Z" variant="datetime" relative />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Actor attribution</h2>
        <div className="mt-4 space-y-3">
          <ActorAttribution
            name="M.-C. Fosto"
            type="ADMIN"
            at="2026-09-30T14:23:00.000Z"
            prefix="Verified by"
            variant="sentence"
          />
          <ActorAttribution
            name="M.-C. Fosto"
            type="ADMIN"
            at="2026-09-30T14:23:00.000Z"
            variant="cell"
          />
          <ActorAttribution
            name="Awa Ngwa"
            type="AGENT"
            at="2026-09-30T14:23:00.000Z"
            variant="table-cell"
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Copyable value</h2>
        <div className="mt-4 flex items-center gap-3">
          <code className="font-mono text-sm">CM-9F2A41</code>
          <CopyButton value="CM-9F2A41" variant="icon" />
          <CopyButton value="CM-9F2A41" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="small">
              Primary small
            </Button>
            <Button variant="secondary" size="small">
              Secondary small
            </Button>
            <Button variant="danger" size="small">
              Danger small
            </Button>
            <Button variant="ghost" size="small">
              Ghost small
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled>
              Disabled primary
            </Button>
            <Button variant="secondary" disabled>
              Disabled secondary
            </Button>
            <Button variant="danger" disabled>
              Disabled danger
            </Button>
            <Button variant="primary" loading loadingLabel="Saving…">
              Save
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/" variant="primary">
              A link button
            </ButtonLink>
            <ButtonLink href="https://example.com" variant="secondary">
              External
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Text inputs</h2>
        <div className="mt-4 grid max-w-md gap-4">
          <TextInput
            name="ref-default"
            label="Referral code"
            placeholder="e.g. AWA01"
            helper="Must be unique."
          />
          <TextInput
            name="ref-filled"
            label="Referral code"
            defaultValue="EST11"
            helper="Must be unique."
          />
          <TextInput
            name="ref-error"
            label="Referral code"
            defaultValue="AWA01"
            error="This referral code is taken."
          />
          <TextInput
            name="ref-disabled"
            label="Referral code"
            defaultValue="AWA01"
            helper="Only an administrator can change this."
            disabled
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Empty state (no matches)</h2>
        <div className="mt-4 rounded border border-border-default bg-surface">
          <TableShell
            state="empty"
            emptyVariant="no-matches"
            emptyEntityLabel="commissions"
            emptyActionLabel="Clear filters"
            onEmptyAction={() => {}}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Empty state (first use)</h2>
        <div className="mt-4 rounded border border-border-default bg-surface">
          <TableShell
            state="empty"
            emptyVariant="first-use"
            emptyEntityLabel="commissions"
            emptyActionLabel="New commission"
            onEmptyAction={() => {}}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Loading</h2>
        <div className="mt-4 rounded border border-border-default bg-surface py-2">
          <TableShell state="loading" skeletonRows={4} skeletonColumns={5} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Error</h2>
        <div className="mt-4 rounded border border-border-default bg-surface">
          <TableShell
            state="error"
            errorTitle="Commissions did not load."
            errorDescription="The server did not respond. Nothing was changed. Check your connection and try again."
            onRetry={() => {}}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Filter bar</h2>
        <div className="mt-4">
          <FilterBar trailing="Showing 1–10 of 138">
            <FilterSearch
              name="search"
              placeholder="Search customer ID"
              value=""
              onChange={() => {}}
            />
            <FilterSelect
              name="status"
              label="Status: All"
              value=""
              onChange={() => {}}
              options={[
                { value: 'PENDING' as const, label: 'Pending' },
                { value: 'VERIFIED' as const, label: 'Verified' },
                { value: 'APPROVED' as const, label: 'Approved' },
                { value: 'PAID' as const, label: 'Paid' },
              ]}
            />
            <FilterPeriod name="period" label="Period" value="2026-09" onChange={() => {}} />
          </FilterBar>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Onboarding stage</h2>
        <div className="mt-4 space-y-6">
          <OnboardingStageIndicator stage="REGISTERED" variant="compact" />
          <OnboardingStageIndicator stage="PROFILE_COMPLETE" variant="compact" />
          <OnboardingStageIndicator stage="VERIFIED" variant="compact" />
          <OnboardingStageIndicator stage="ONBOARDED" variant="compact" />
          <OnboardingStageIndicator
            stage="VERIFIED"
            variant="full"
            transitions={[
              {
                stage: 'REGISTERED',
                at: '2026-09-15T14:05:00.000Z',
                by: { id: '1', name: 'M.-C. Fosto', type: 'ADMIN' },
              },
              {
                stage: 'PROFILE_COMPLETE',
                at: '2026-09-18T08:30:00.000Z',
                by: { id: '1', name: 'M.-C. Fosto', type: 'ADMIN' },
              },
              {
                stage: 'VERIFIED',
                at: '2026-09-26T11:25:00.000Z',
                by: { id: '1', name: 'M.-C. Fosto', type: 'ADMIN' },
              },
            ]}
          />
        </div>
      </section>

      <DesignInteractives />
    </main>
  );
}
