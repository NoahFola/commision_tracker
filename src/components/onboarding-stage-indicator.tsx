import type { OnboardingStage } from '@/models/agent.model';

const STAGES: OnboardingStage[] = ['REGISTERED', 'PROFILE_COMPLETE', 'VERIFIED', 'ONBOARDED'];

const STAGE_LABELS: Record<OnboardingStage, string> = {
  REGISTERED: 'Registered',
  PROFILE_COMPLETE: 'Profile complete',
  VERIFIED: 'Verified',
  ONBOARDED: 'Onboarded',
};

export type OnboardingTransition = {
  stage: OnboardingStage;
  at: string;
  by: { id: string; name: string; type: 'ADMIN' | 'AGENT' };
};

/**
 * The onboarding stage mini progress bar.
 *
 *   variant="compact"  a small bar + "Onboarded · step 4 of 4"
 *                      (used in the agents list)
 *   variant="full"     a bar with per-step labels below; if
 *                      `transitions` is provided, shows the actor and
 *                      date under each completed step
 *                      (used on the agent profile tab)
 */
export function OnboardingStageIndicator({
  stage,
  variant = 'compact',
  transitions,
}: {
  stage: OnboardingStage;
  variant?: 'compact' | 'full';
  transitions?: OnboardingTransition[];
}) {
  const currentIndex = STAGES.indexOf(stage);
  const stepNumber = currentIndex + 1;
  const total = STAGES.length;

  const bar = (
    <div className="flex gap-1">
      {STAGES.map((_, i) => (
        <div
          key={i}
          className={[
            'h-1 rounded',
            i <= currentIndex ? 'bg-btn-primary-bg' : 'bg-surface-muted',
          ].join(' ')}
          style={{ width: '1rem' }}
        />
      ))}
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-primary">
          {STAGE_LABELS[stage]} · step {stepNumber} of {total}
        </span>
        {bar}
      </div>
    );
  }

  // full
  return (
    <div>
      {bar}
      <div className="mt-3 grid grid-cols-4 gap-3">
        {STAGES.map((s, i) => {
          const reached = i <= currentIndex;
          const transition = transitions?.find((t) => t.stage === s);
          return (
            <div key={s}>
              <p
                className={[
                  'text-xs font-medium',
                  reached ? 'text-text-primary' : 'text-text-tertiary',
                ].join(' ')}
              >
                {i + 1} · {STAGE_LABELS[s]}
              </p>
              {reached && transition && (
                <>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {formatShortDate(transition.at)}
                  </p>
                  <p className="text-[11px] text-text-tertiary">{transition.by.name}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
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
  const day = shifted.getUTCDate();
  const month = months[shifted.getUTCMonth()]!;
  const year = shifted.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
