import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-server';
import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage() {
  // If already logged in, go home.
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <h1 className="text-2xl font-semibold">EpsiHome Tracker</h1>
      <p className="mt-2 text-sm text-neutral">Sign in to continue.</p>
      <LoginForm />
    </main>
  );
}