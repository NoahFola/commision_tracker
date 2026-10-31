import { CurrencyAmount } from '../primitives/currency-amount';
import type { Money } from '@/lib/money/money';
import type { OnboardingStage } from '@/models/agent.model';

const STAGE_LABELS: Record<OnboardingStage, string> = {
  REGISTERED: 'Registered',
  PROFILE_COMPLETE: 'Profile complete',
  VERIFIED: 'Verified',
  ONBOARDED: 'Onboarded',
};

const STAGE_STEPS: Record<OnboardingStage, number> = {
  REGISTERED: 1,
  PROFILE_COMPLETE: 2,
  VERIFIED: 3,
  ONBOARDED: 4,
};

/**
 * Four summary tiles shown above the tabs:
 * Owed now · Being checked · Paid to date · Onboarding
 */
export function AgentSummaryTiles({
  owedNow,
  owedNowCount,
  beingChecked,
  beingCheckedCount,
  paidToDate,
  paidToDateCount,
  lastPaidAt,
  onboardingStage,
}: {
  owedNow: Money;
  owedNowCount: number;
  beingChecked: Money;
  beingCheckedCount: number;
  paidToDate: Money;
  paidToDateCount: number;
  lastPaidAt: string | null;
  onboardingStage: OnboardingStage;
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="OWED NOW"
        value={<CurrencyAmount value={owedNow} className="text-lg font-semibold" />}
        caption={`${owedNowCount} approved commission${owedNowCount === 1 ? '' : 's'}`}
      />
      <Tile
        label="BEING CHECKED"
        value={<CurrencyAmount value={beingChecked} className="text-lg font-semibold" />}
        caption={`${beingCheckedCount} pending commission${beingCheckedCount === 1 ? '' : 's'}`}
      />
      <Tile
        label="PAID TO DATE"
        value={<CurrencyAmount value={paidToDate} className="text-lg font-semibold" />}
        caption={
          lastPaidAt
            ? `${paidToDateCount} payout${paidToDateCount === 1 ? '' : 's'} · last on ${formatShortDate(lastPaidAt)}`
            : 'No payouts yet'
        }
      />
      <Tile
        label="ONBOARDING"
        value={<span className="text-lg font-semibold">{STAGE_LABELS[onboardingStage]}</span>}
        caption={`Step ${STAGE_STEPS[onboardingStage]} of 4`}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  caption,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
}) {
  return (
    <div className="rounded border border-border-default bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-1">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{caption}</p>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${shifted.getUTCDate()} ${months[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}`;
}
