import { NextResponse } from 'next/server';
import { db, audit } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { ReviewSchema } from '@/lib/validate';
import { MAX_RETAKES } from '@/lib/pod-rules';

export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const user = await requireUser('billing');
  if (!user) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { tripId } = await ctx.params;
  const body = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!body.success || !/^TRP-\d{4,8}$/.test(tripId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const d = db();
  const trip = d.prepare('SELECT id, pod_status, retake_count FROM trips WHERE id = ?').get(tripId) as { id: string; pod_status: string; retake_count: number } | undefined;
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.pod_status !== 'needs_review') return NextResponse.json({ error: 'This POD is not waiting for review' }, { status: 409 });
  const sub = d.prepare('SELECT id FROM pod_submissions WHERE trip_id = ? ORDER BY id DESC LIMIT 1').get(tripId) as { id: number } | undefined;

  const { action, corrections } = body.data;
  if (action === 'retake') {
    if (trip.retake_count >= MAX_RETAKES) return NextResponse.json({ error: 'Retake limit (2) reached. Approve, or contact the driver directly.' }, { status: 409 });
    d.prepare("UPDATE trips SET pod_status = 'retake_requested', retake_count = retake_count + 1, remarks = ? WHERE id = ?").run(corrections?.note || 'Retake asked by billing', tripId);
  } else {
    // The image stays the source of truth; corrections are stored beside the AI reading, never over it.
    if (sub && corrections) d.prepare('UPDATE pod_submissions SET corrected_json = ? WHERE id = ?').run(JSON.stringify({ ...corrections, by: user.login, at: new Date().toISOString() }), sub.id);
    d.prepare("UPDATE trips SET pod_status = 'verified', remarks = ? WHERE id = ?").run(corrections?.remarks || null, tripId);
  }
  audit(user.login, `review_${action}`, tripId, corrections);
  return NextResponse.json({ ok: true });
}
