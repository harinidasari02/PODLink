import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { NextResponse } from 'next/server';
import { db, UPLOAD_DIR, audit } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { buildTallyXml, csvCell } from '@/lib/tally';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser('billing');
  if (!user) return new NextResponse('Not allowed', { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new NextResponse('Not found', { status: 404 });
  const d = db();
  const inv = d.prepare('SELECT i.*, c.tally_ledger FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ?').get(id) as
    { id: number; number: string; cycle_label: string; total: number; created_at: string; tally_ledger: string } | undefined;
  if (!inv) return new NextResponse('Not found', { status: 404 });
  const trips = d.prepare(`SELECT t.id, t.lr_no, t.eway_bill_no, t.vehicle_no, t.destination, t.freight, t.delivered_on,
      (SELECT image_file FROM pod_submissions WHERE trip_id = t.id ORDER BY id DESC LIMIT 1) AS image_file
      FROM trips t WHERE t.invoice_id = ? ORDER BY t.delivered_on`).all(id) as
    { id: string; lr_no: string; eway_bill_no: string; vehicle_no: string; destination: string; freight: number; delivered_on: string; image_file: string | null }[];

  const zip = new JSZip();
  const lrList = trips.map((t) => t.lr_no).join(', ');
  zip.file('tally-sales-voucher.xml', buildTallyXml({
    company: 'Company A', number: inv.number, date: inv.created_at.slice(0, 10), partyLedger: inv.tally_ledger,
    total: inv.total, narration: `Freight for ${trips.length} ${trips.length === 1 ? "trip" : "trips"}, cycle ${inv.cycle_label}. LR: ${lrList}`.slice(0, 900),
  }));
  const lines = ['trip_id,lr_no,eway_bill_no,vehicle_no,destination,delivered_on,freight,pod_file'];
  for (const t of trips) {
    const podName = t.image_file ? `pods/${t.lr_no}.jpg` : '';
    lines.push([t.id, t.lr_no, t.eway_bill_no, t.vehicle_no, t.destination, t.delivered_on, t.freight, podName].map(csvCell).join(','));
    if (t.image_file) {
      const p = path.join(UPLOAD_DIR, path.basename(t.image_file));
      if (fs.existsSync(p)) zip.file(podName, fs.readFileSync(p));
    }
  }
  zip.file('invoice-lines.csv', lines.join('\n') + '\n');
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  audit(user.login, 'invoice_exported', null, { invoice: inv.number });
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${inv.number}-tally-and-pods.zip"` },
  });
}
