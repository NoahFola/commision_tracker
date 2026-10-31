import { CopyButton } from '../primitives/copy-button';
import { LogoutButton } from '../auth/logout-button';

/**
 * Footer block on the agent home. Shows the agent's avatar initials,
 * name, phone, referral code with a Copy button, and a link to Profile.
 */
export function AgentProfileFooter({
  name,
  phone,
  referralCode,
}: {
  name: string;
  phone: string;
  referralCode: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section className="rounded-lg border border-border-default bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-sm font-semibold text-success-fg">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{phone}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-default pt-3">
        <div>
          <p className="text-xs text-text-secondary">Referral code</p>
          <p className="mt-0.5 font-mono text-sm font-medium">{referralCode}</p>
        </div>
        <CopyButton value={referralCode} />
      </div>
      <p className="mt-3">
        <a
          href="/profile"
          className="focus-ring rounded text-sm text-text-secondary underline-offset-2 hover:underline"
        >
          My profile
        </a>
      </p>
      <p className="mt-3">
        <LogoutButton />
      </p>
    </section>
  );
}
