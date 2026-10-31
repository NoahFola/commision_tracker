import Link from 'next/link';
import { CurrencyAmount } from '../primitives/currency-amount';
import { nextPayoutProjection } from '@/lib/time/payout-projection';
import type { Money } from '@/lib/money';

const MINIMUM_BATCH_AMOUNT_XAF = 5000;

/**
 * The agent home hero card. Three variants, chosen by the agent's state:
 *
 *   - "owed"          Approved balance > 0 but below the 5,000 XAF minimum.
 *                     Shows a progress bar.
 *   - "ready"         Approved balance >= 5,000 XAF. Green success line.
 *   - "empty"         No approved commissions at all. Muted.
 *
 * All three show the payout projection (from nextPayoutProjection) and
 * the agent's payout method.
 */
export function AgentHomeHero({
  owedNow,
  owedNowCount,
  payoutPreference,
}: {
  owedNow: Money;
  owedNowCount: number;
  payoutPreference: {
    method: 'MOBILE_MONEY' | 'BANK' | 'CASH';
    provider?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
  };
}) {
  const projection = nextPayoutProjection();
  const isReady = owedNow.amount >= MINIMUM_BATCH_AMOUNT_XAF;
  const isEmpty = owedNow.amount <= 0;

  const methodLine = formatMethodLine(payoutPreference);

  return (
    <section className="rounded-2xl bg-[#1e293b] p-6 text-white">
      {isEmpty ? (
        <>
          <p className="text-sm text-slate-300">You are owed</p>
          <p className="mt-1 text-3xl font-semibold">0 {owedNow.currency}</p>
          <p className="mt-3 text-sm text-slate-300">You have no approved earnings yet.</p>
        </>
      ) : isReady ? (
        <>
          <p className="text-sm text-slate-300">You are owed</p>
          <p className="mt-1 text-3xl font-semibold">
            <CurrencyAmount value={owedNow} />
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-300">
            ✓ Ready to pay · {owedNowCount} commission
            {owedNowCount === 1 ? '' : 's'}
          </p>
          <div className="mt-4 border-t border-white/15 pt-3">
            <p className="text-xs text-slate-300">When will I be paid?</p>
            <p className="mt-1 text-lg font-semibold">Next payout on {projection.display}</p>
            <p className="mt-1 text-xs text-slate-300">By {methodLine}</p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-300">You need</p>
          <p className="mt-1 text-3xl font-semibold">
            <CurrencyAmount
              value={{
                amount: MINIMUM_BATCH_AMOUNT_XAF - owedNow.amount,
                currency: owedNow.currency,
              }}
            />
          </p>
          <p className="mt-1 text-sm text-slate-300">more to withdraw</p>
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-green-400"
                style={{
                  width: `${Math.min(100, (owedNow.amount / MINIMUM_BATCH_AMOUNT_XAF) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-300">
              <span>
                <CurrencyAmount value={owedNow} />
              </span>
              <span>{MINIMUM_BATCH_AMOUNT_XAF.toLocaleString('en-US')} XAF</span>
            </div>
          </div>
          <div className="mt-4 border-t border-white/15 pt-3">
            <p className="text-sm text-slate-100">
              You are owed <CurrencyAmount value={owedNow} />.
            </p>
            <p className="mt-1 text-sm text-slate-100">
              Payouts start at {MINIMUM_BATCH_AMOUNT_XAF.toLocaleString('en-US')} XAF.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function formatMethodLine(pref: {
  method: 'MOBILE_MONEY' | 'BANK' | 'CASH';
  provider?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
}): string {
  const label =
    pref.method === 'MOBILE_MONEY'
      ? 'mobile money'
      : pref.method === 'BANK'
        ? 'bank transfer'
        : 'cash';
  const parts: string[] = [label];
  if (pref.provider) parts.push(pref.provider);
  if (pref.accountNumber) parts.push(pref.accountNumber);
  if (pref.accountName) parts.push(pref.accountName);
  return parts.join(' · ');
}

/** Renders nothing here; kept as a stub so `Link` import stays used. */
void Link;
