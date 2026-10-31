import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth/session-server';
import { Sidebar } from '@/components/layout/sidebar';

/**
 * Admin layout. Enforces the admin role in one place; every page under
 * /admin inherits the check.
 *
 * The layout is nested inside the root layout (which provides the
 * ToastProvider), so components in here can call useToast().
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
