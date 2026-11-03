import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { db } from './db';
import { cycleKey } from './cycles';
import type { BillingCycle } from './types';

export class BillingError extends Error {}

/**
 * Group verified trips of one client and one billing cycle into an invoice batch.
 * Invoices are never sent automatically; this only prepares the batch and marks trips "billed".
 */
export function createInvoice(clientId: number, tripIds: string[], userId: number, d: Database.Database = db(), now = new Date()) {
  const client = d.prepare('SELECT id, billing_cycle FROM clients WHERE id = ?').get(clientId) as { id: number; billing_cycle: BillingCycle } | undefined;
  if (!client) throw new BillingError('Client not found');
  const unique = [...new Set(tripIds)];
  const tx = d.transaction(() => {
    const rows = unique.map((id) => d.prepare('SELECT id, client_id, freight, pod_status, delivered_on FROM trips WHERE id = ?').get(id) as
      { id: string; client_id: number; freight: number; pod_status: string; delivered_on: string | null } | undefined);
    for (const [i, r] of rows.entries()) {
      if (!r) throw new BillingError(`Trip ${unique[i]} not found`);
      if (r.client_id !== clientId) throw new BillingError(`Trip ${r.id} belongs to a different client`);
      if (r.pod_status !== 'verified') throw new BillingError(`Trip ${r.id} is not ready to bill`);
      if (!r.delivered_on) throw new BillingError(`Trip ${r.id} has no delivery date`);
    }
    const labels = new Set(rows.map((r) => cycleKey(r!.delivered_on!, client.billing_cycle)));
    if (labels.size !== 1) throw new BillingError('Trips come from different billing cycles. Invoice one cycle at a time.');
    const total = rows.reduce((s, r) => s + r!.freight, 0);
    const last = (d.prepare("SELECT COALESCE(MAX(CAST(substr(number, 10) AS INTEGER)), 0) AS n FROM invoices WHERE number LIKE 'INV-2026-%'").get() as { n: number }).n;
    const number = `INV-2026-${String(last + 1).padStart(4, '0')}`;
    const res = d.prepare('INSERT INTO invoices (client_id, cycle_label, number, total, created_by, created_at, share_token) VALUES (?,?,?,?,?,?,?)')
      .run(clientId, [...labels][0], number, total, userId, now.toISOString(), crypto.randomBytes(16).toString('hex'));
    const id = Number(res.lastInsertRowid);
    const upd = d.prepare("UPDATE trips SET pod_status = 'billed', invoice_id = ? WHERE id = ? AND pod_status = 'verified'");
    for (const t of unique) if (upd.run(id, t).changes !== 1) throw new BillingError(`Trip ${t} changed while invoicing. Reload and retry.`);
    return { id, number, total, cycle_label: [...labels][0] };
  });
  return tx();
}
