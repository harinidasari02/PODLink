import { redirect } from 'next/navigation';
import { getUser } from '@/lib/session';
import { LoginForm } from './LoginForm';
import { Logo } from '@/components/ui';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const u = await getUser();
  if (u) redirect(u.role === 'driver' ? '/driver' : '/billing');
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Logo size={26} />
      <h1 className="mt-8 text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-soft">Proof of delivery, checked at the gate.</p>
      <LoginForm />
    </main>
  );
}
