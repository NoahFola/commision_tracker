// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  AgentStatusBadge,
  CommissionStatusBadge,
  BatchStatusBadge,
  ReversalBadge,
} from '../../primitives/status-badge';

afterEach(() => cleanup());

describe('AgentStatusBadge', () => {
  it.each([
    ['ACTIVE', 'Active'],
    ['SUSPENDED', 'Suspended'],
    ['INACTIVE', 'Inactive'],
    ['TERMINATED', 'Terminated'],
  ] as const)('renders %s as %s', (status, label) => {
    render(<AgentStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('CommissionStatusBadge', () => {
  it.each([
    ['PENDING', 'Pending'],
    ['VERIFIED', 'Verified'],
    ['APPROVED', 'Approved'],
    ['PAID', 'Paid'],
  ] as const)('renders %s as %s', (status, label) => {
    render(<CommissionStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('BatchStatusBadge', () => {
  it.each([
    ['DRAFT', 'Draft'],
    ['APPROVED', 'Approved'],
    ['PROCESSING', 'Processing'],
    ['PAID', 'Paid'],
    ['FAILED', 'Failed'],
  ] as const)('renders %s as %s', (status, label) => {
    render(<BatchStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('ReversalBadge', () => {
  it('renders the label and uses the outlined style', () => {
    const { container } = render(<ReversalBadge />);
    expect(screen.getByText('Reversal')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('border');
  });
});
