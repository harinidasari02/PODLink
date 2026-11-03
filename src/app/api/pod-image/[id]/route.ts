import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db, UPLOAD_DIR } from '@/lib/db';
import { getUser } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const subId = Number(id);
  if (!Number.isInteger(subId)) return new NextResponse('Not found', { status: 404 });
  const row = db().prepare(`SELECT s.image_file, t.driver_id, t.invoice_id FROM pod_submissions s JOIN trips t ON t.id = s.trip_id WHERE s.id = ?`).get(subId) as
    { image_file: string; driver_id: number | null; invoice_id: number | null } | undefined;
  if (!row) return new NextResponse('Not found', { status: 404 });

  const user = await getUser();
  let allowed = false;
  if (user?.role === 'billing') allowed = true;
  else if (user?.role === 'driver' && row.driver_id === user.id) allowed = true;
  else {
    // read-only client link: only PODs of the invoiced trips behind that share token
    const share = new URL(req.url).searchParams.get('share');
    if (share && row.invoice_id) {
      allowed = !!db().prepare('SELECT 1 FROM invoices WHERE id = ? AND share_token = ?').get(row.invoice_id, share);
    }
  }
  if (!allowed) return new NextResponse('Forbidden', { status: 403 });

  const file = path.join(UPLOAD_DIR, path.basename(row.image_file)); // basename blocks path traversal
  if (!fs.existsSync(file)) return new NextResponse('Image missing', { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' },
  });
}
