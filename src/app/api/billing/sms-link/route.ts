import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { db, audit } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { SmsLinkSchema } from '@/lib/validate';

/** Creates a single-trip upload link for a hired driver. SMS sending is mocked: the link is returned to the executive. */
export async function POST(req: Request) {
  const user = await requireUser('billing');
  if (!user) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const body = SmsLinkSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const trip = db().prepare('SELECT id, hired, pod_status FROM trips WHERE id = ?').get(body.data.tripId) as { id: string; hired: number; pod_status: string } | undefined;
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.pod_status === 'verified' || trip.pod_status === 'billed') return NextResponse.json({ error: 'This trip already has an accepted POD' }, { status: 409 });
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  db().prepare('INSERT INTO sms_links (token, trip_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(token, trip.id, now.toISOString(), new Date(now.getTime() + 72 * 3600_000).toISOString());
  audit(user.login, 'sms_link_created', trip.id);
  const origin = new URL(req.url).origin;
  return NextResponse.json({ ok: true, url: `${origin}/u/${token}`, expiresInHours: 72, mock: true });
}
