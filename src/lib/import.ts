import type Database from 'better-sqlite3';
import { db } from './db';
import { TripImportRowSchema } from './validate';

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export interface ImportReport { inserted: number; updated: number; skipped: number; errors: { line: number; message: string }[] }

export const IMPORT_COLUMNS = ['trip_id', 'lr_no', 'eway_bill_no', 'client', 'vehicle_no', 'hired', 'origin', 'destination', 'branch', 'freight', 'qty', 'consignee_name', 'consignee_phone', 'dispatch_on', 'delivered_on'];

export function importTrips(csv: string, d: Database.Database = db()): ImportReport {
  const rep: ImportReport = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const rows = parseCsv(csv);
  if (rows.length < 2) { rep.errors.push({ line: 1, message: 'File has no data rows' }); return rep; }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missingCols = IMPORT_COLUMNS.filter((c) => c !== 'consignee_phone' && c !== 'delivered_on' && !header.includes(c));
  if (missingCols.length) { rep.errors.push({ line: 1, message: `Missing columns: ${missingCols.join(', ')}` }); return rep; }
  if (rows.length > 5001) { rep.errors.push({ line: 1, message: 'Too many rows (max 5000 per file)' }); return rep; }

  const clients = d.prepare('SELECT id, name, tally_ledger FROM clients').all() as { id: number; name: string; tally_ledger: string }[];
  const find = d.prepare('SELECT pod_status FROM trips WHERE id = ?');
  const lrTaken = d.prepare('SELECT id FROM trips WHERE lr_no = ?');
  const ins = d.prepare(`INSERT INTO trips (id,lr_no,eway_bill_no,client_id,vehicle_no,hired,origin,destination,branch,freight,qty,consignee_name,consignee_phone,dispatch_on,delivered_on)
    VALUES (@trip_id,@lr_no,@eway_bill_no,@client_id,@vehicle_no,@hired,@origin,@destination,@branch,@freight,@qty,@consignee_name,@consignee_phone,@dispatch_on,@delivered_on)`);

  const tx = d.transaction(() => {
    rows.slice(1).forEach((cells, idx) => {
      const line = idx + 2;
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
      const p = TripImportRowSchema.safeParse(obj);
      if (!p.success) { rep.errors.push({ line, message: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }); rep.skipped++; return; }
      const v = p.data;
      const client = clients.find((c) => c.name.toLowerCase() === v.client.toLowerCase() || c.tally_ledger.toLowerCase() === v.client.toLowerCase());
      if (!client) { rep.errors.push({ line, message: `Unknown client "${v.client}"` }); rep.skipped++; return; }
      const existing = find.get(v.trip_id) as { pod_status: string } | undefined;
      if (existing) {
        // Re-import of the same day's file is safe: only a missing delivery date is filled in.
        if (v.delivered_on && existing.pod_status !== 'billed') {
          const r = d.prepare('UPDATE trips SET delivered_on = ? WHERE id = ? AND delivered_on IS NULL').run(v.delivered_on, v.trip_id);
          if (r.changes) { rep.updated++; return; }
        }
        rep.skipped++; return;
      }
      if (lrTaken.get(v.lr_no)) { rep.errors.push({ line, message: `LR ${v.lr_no} already used by another trip` }); rep.skipped++; return; }
      ins.run({ ...v, client_id: client.id, hired: v.hired === 'yes' ? 1 : 0, delivered_on: v.delivered_on || null });
      rep.inserted++;
    });
  });
  tx();
  return rep;
}
