import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('driver');
  if (!u) redirect('/login');
  return <>{children}</>;
}
