// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuditTable, type AuditRow } from '../../admin/audit-table';

afterEach(() => cleanup());

const createRow: AuditRow = {
  id: 'r1',
  at: '2026-09-15T14:05:00.000Z',
  action: 'CREATE',
  actor: { name: 'M.-C. Fosto', type: 'ADMIN' },
  before: null,
  after: { status: 'ACTIVE' },
  reason: null,
};

const updateRow: AuditRow = {
  id: 'r2',
  at: '2026-09-28T10:14:00.000Z',
  action: 'UPDATE',
  actor: { name: 'Awa Ngwa', type: 'AGENT' },
  before: { payoutAccountNumber: '677000111' },
  after: { payoutAccountNumber: '677000000' },
  reason: 'Fixed number',
};

describe('AuditTable', () => {
  it('renders an empty state when no rows', () => {
    render(<AuditTable rows={[]} />);
    expect(screen.getByText('No audit rows yet.')).toBeInTheDocument();
  });

  it('renders the actor name and type', () => {
    render(<AuditTable rows={[createRow, updateRow]} />);
    expect(screen.getByText('M.-C. Fosto')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Awa Ngwa')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('renders "Created" for CREATE rows and a diff for UPDATE rows', () => {
    render(<AuditTable rows={[createRow, updateRow]} />);
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText(/677000111 → 677000000/)).toBeInTheDocument();
  });

  it('renders the reason when present', () => {
    render(<AuditTable rows={[updateRow]} />);
    expect(screen.getByText(/Fixed number/)).toBeInTheDocument();
  });
});