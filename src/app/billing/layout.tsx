import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { BillingNav } from '@/components/BillingNav';

export const dynamic = 'force-dynamic';

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('billing');
  if (!u) redirect('/login');
  const review = (db().prepare("SELECT COUNT(*) c FROM trips WHERE pod_status = 'needs_review'").get() as { c: number }).c;
  return (
    <div className="min-h-dvh">
      <BillingNav name={u.name} reviewCount={review} />
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">{children}</div>
    </div>
  );
}
