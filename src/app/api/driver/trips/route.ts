import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { driverTrips } from '@/lib/queries';

export async function GET() {
  const user = await requireUser('driver');
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  return NextResponse.json({ trips: driverTrips(user.id) });
}
