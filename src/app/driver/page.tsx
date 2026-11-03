import { requireUser } from '@/lib/session';
import { driverTrips } from '@/lib/queries';
import { DriverHome } from './DriverHome';
import type { Lang } from '@/lib/types';

export const metadata = { title: 'My trips' };
export const dynamic = 'force-dynamic';

export default async function DriverPage() {
  const u = (await requireUser('driver'))!;
  return <DriverHome name={u.name} defaultLang={u.lang as Lang} trips={driverTrips(u.id)} />;
}
