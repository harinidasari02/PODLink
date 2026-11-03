import { redirect } from 'next/navigation';
import { getUser } from '@/lib/session';

export default async function Home() {
  const u = await getUser();
  redirect(!u ? '/login' : u.role === 'driver' ? '/driver' : '/billing');
}
