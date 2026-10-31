// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OnboardingStageIndicator } from '../../onboarding-stage-indicator';

afterEach(() => cleanup());

describe('OnboardingStageIndicator', () => {
  it('renders the compact variant with the step count', () => {
    render(<OnboardingStageIndicator stage="VERIFIED" variant="compact" />);
    expect(screen.getByText(/Verified · step 3 of 4/)).toBeInTheDocument();
  });

  it('renders the full variant with all stage labels', () => {
    render(<OnboardingStageIndicator stage="ONBOARDED" variant="full" />);
    expect(screen.getByText(/1 · Registered/)).toBeInTheDocument();
    expect(screen.getByText(/4 · Onboarded/)).toBeInTheDocument();
  });

  it('shows actor and date when transitions are provided', () => {
    render(
      <OnboardingStageIndicator
        stage="VERIFIED"
        variant="full"
        transitions={[
          {
            stage: 'REGISTERED',
            at: '2026-09-15T14:05:00.000Z',
            by: { id: '1', name: 'M.-C. Fosto', type: 'ADMIN' },
          },
        ]}
      />,
    );
    expect(screen.getByText('M.-C. Fosto')).toBeInTheDocument();
    expect(screen.getByText(/15 Sep 2026/)).toBeInTheDocument();
  });
});
