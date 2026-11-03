import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/session';
import { UploadFieldsSchema } from '@/lib/validate';
import { processPodUpload, UploadError } from '@/lib/pod-service';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`upload:${ip}`, 60, 60_000)) return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
  const f = UploadFieldsSchema.safeParse(raw);
  const file = form.get('image');
  if (!f.success || !(file instanceof File)) return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  const v = f.data;

  // Access control: a logged-in driver for their own trip, OR a valid unexpired SMS token for exactly this trip.
  let source: 'app' | 'sms_link';
  if (v.token) {
    const link = db().prepare('SELECT trip_id FROM sms_links WHERE token = ? AND expires_at > ?').get(v.token, new Date().toISOString()) as { trip_id: string } | undefined;
    if (!link || link.trip_id !== v.tripId) return NextResponse.json({ error: 'This link has expired' }, { status: 403 });
    source = 'sms_link';
  } else {
    const user = await getUser();
    if (!user || user.role !== 'driver') return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    const own = db().prepare('SELECT 1 FROM trips WHERE id = ? AND driver_id = ?').get(v.tripId, user.id);
    if (!own) return NextResponse.json({ error: 'Not your trip' }, { status: 403 });
    source = 'app';
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await processPodUpload({
      tripId: v.tripId, image: buf, capturedAt: v.capturedAt,
      lat: v.lat ?? null, lng: v.lng ?? null, accuracy: v.accuracy ?? null,
      offline: v.offline === '1', clientRef: v.clientRef ?? null, source,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
