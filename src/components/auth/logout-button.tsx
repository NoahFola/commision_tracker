'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={submitting}
      className="text-sm text-neutral underline-offset-2 hover:underline disabled:opacity-60"
    >
      {submitting ? 'Signing out…' : 'Sign out'}
    </button>
  );
}