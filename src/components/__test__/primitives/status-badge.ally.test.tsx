// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  AgentStatusBadge,
  CommissionStatusBadge,
  BatchStatusBadge,
  ReversalBadge,
} from '@/components/primitives/status-badge';

afterEach(() => cleanup());

describe('status badge accessibility', () => {
  it('AgentStatusBadge exposes its status as text', () => {
    render(<AgentStatusBadge status="ACTIVE" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('ReversalBadge has non-colour text', () => {
    render(<ReversalBadge />);
    // Reversal identification must not rely on colour alone.
    expect(screen.getByText('Reversal')).toBeInTheDocument();
  });

  it('CommissionStatusBadge and BatchStatusBadge expose text', () => {
    render(<CommissionStatusBadge status="PENDING" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    cleanup();
    render(<BatchStatusBadge status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
