import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { importTrips } from '@/lib/import';
import { audit } from '@/lib/db';

export async function POST(req: Request) {
  const user = await requireUser('billing');
  if (!user) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const text = await req.text();
  if (text.length > 2_000_000) return NextResponse.json({ error: 'File too large (max 2 MB)' }, { status: 413 });
  const report = importTrips(text);
  audit(user.login, 'trips_imported', null, { inserted: report.inserted, updated: report.updated, skipped: report.skipped });
  return NextResponse.json(report);
}
