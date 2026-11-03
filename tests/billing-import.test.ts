import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb, seedDatabase } from '@/lib/db';
import { BillingError, createInvoice } from '@/lib/billing';
import { importTrips, parseCsv } from '@/lib/import';
import { billingQueue, dashboard, driverTrips } from '@/lib/queries';

let d: Database.Database;
beforeEach(() => { d = openDb(':memory:'); seedDatabase(d); });

describe('billing queue and invoices', () => {
  it('groups verified trips by client and cycle', () => {
    const q = billingQueue(d, '2026-11-03');
    expect(q.length).toBeGreaterThan(3);
    for (const g of q) {
      expect(g.trips.every((t) => t.freight > 0)).toBe(true);
      expect(g.total).toBe(g.trips.reduce((s, t) => s + t.freight, 0));
    }
    expect(q.flatMap((g) => g.trips.map((t) => t.id))).toContain('TRP-66120');
  });
  it('creates an invoice and marks trips billed', () => {
    const g = billingQueue(d)[0];
    const inv = createInvoice(g.client_id, g.trips.map((t) => t.id), 1, d);
    expect(inv.total).toBe(g.total);
    const row = d.prepare('SELECT pod_status, invoice_id FROM trips WHERE id = ?').get(g.trips[0].id) as { pod_status: string; invoice_id: number };
    expect(row.pod_status).toBe('billed');
    expect(row.invoice_id).toBe(inv.id);
  });
  it('refuses to invoice the same trip twice', () => {
    const g = billingQueue(d)[0];
    createInvoice(g.client_id, g.trips.map((t) => t.id), 1, d);
    expect(() => createInvoice(g.client_id, g.trips.map((t) => t.id), 1, d)).toThrow(BillingError);
  });
  it('refuses trips that need review, or another client', () => {
    expect(() => createInvoice(3, ['TRP-66141'], 1, d)).toThrow(/not ready/);
    const g = billingQueue(d)[0];
    expect(() => createInvoice(g.client_id === 1 ? 2 : 1, [g.trips[0].id], 1, d)).toThrow(/different client/);
  });
  it('refuses to mix billing cycles in one invoice', () => {
    const wk = billingQueue(d).filter((g) => g.client_id === 1);
    if (wk.length >= 2) {
      expect(() => createInvoice(1, [wk[0].trips[0].id, wk[1].trips[0].id], 1, d)).toThrow(/different billing cycles/);
    }
  });
  it('rolls back everything if one trip is invalid', () => {
    const g = billingQueue(d)[0];
    expect(() => createInvoice(g.client_id, [g.trips[0].id, 'TRP-99999'], 1, d)).toThrow();
    const row = d.prepare('SELECT pod_status FROM trips WHERE id = ?').get(g.trips[0].id) as { pod_status: string };
    expect(row.pod_status).toBe('verified');
  });
});

describe('dashboard and seed', () => {
  it('contains the three sample trips from the brief with the right status', () => {
    const s = (id: string) => (d.prepare('SELECT pod_status, freight FROM trips WHERE id = ?').get(id) as { pod_status: string; freight: number });
    expect(s('TRP-66120')).toEqual({ pod_status: 'verified', freight: 38500 });
    expect(s('TRP-66134')).toEqual({ pod_status: 'retake_requested', freight: 26000 });
    expect(s('TRP-66141')).toEqual({ pod_status: 'needs_review', freight: 41200 });
  });
  it('counts missing PODs by age', () => {
    const dash = dashboard(d, '2026-11-03');
    expect(dash.kpi.missing).toBe(dash.aging.reduce((s, a) => s + a.n, 0));
    expect(dash.byBranch.length).toBe(4);
    expect(dash.kpi.avg_days).toBeGreaterThan(0);
  });
  it('shows a driver only their own trips', () => {
    const uid = (d.prepare("SELECT id FROM users WHERE login = 'D101'").get() as { id: number }).id;
    const trips = driverTrips(uid, d);
    expect(trips.map((t) => t.id)).toContain('TRP-66150');
    expect(trips.every((t) => !('consignee_phone' in t))).toBe(true);
    const other = driverTrips(uid + 1, d);
    expect(other.map((t) => t.id)).not.toContain('TRP-66150');
  });
});

describe('daily trip import', () => {
  const header = 'trip_id,lr_no,eway_bill_no,client,vehicle_no,hired,origin,destination,branch,freight,qty,consignee_name,consignee_phone,dispatch_on,delivered_on';
  const row = (o: Partial<Record<string, string>> = {}) => {
    const v = { trip_id: 'TRP-70001', lr_no: 'LR-NEW70001', eway: '391012345678', client: 'Company B (cement)', veh: 'MH20 AB 1234', hired: 'no', o: 'Pune', dst: 'Nashik', br: 'Pune', fr: '30000', q: '400', cn: 'Test Traders', ph: '90000 00000', dp: '2026-11-03', dl: '', ...o };
    return [v.trip_id, v.lr_no, v.eway, v.client, v.veh, v.hired, v.o, v.dst, v.br, v.fr, v.q, v.cn, v.ph, v.dp, v.dl].join(',');
  };
  it('inserts valid rows', () => {
    const r = importTrips([header, row()].join('\n'), d);
    expect(r).toMatchObject({ inserted: 1, skipped: 0, errors: [] });
  });
  it('is safe to re-import the same file', () => {
    const csv = [header, row()].join('\n');
    importTrips(csv, d);
    expect(importTrips(csv, d)).toMatchObject({ inserted: 0, skipped: 1 });
  });
  it('rejects a bad e-way bill, unknown client and duplicate LR with line numbers', () => {
    const csv = [header, row({ eway: '123' }), row({ trip_id: 'TRP-70002', lr_no: 'LR-X2', client: 'Nobody Ltd' }), row({ trip_id: 'TRP-70003', lr_no: 'LR-CH66150' })].join('\n');
    const r = importTrips(csv, d);
    expect(r.inserted).toBe(0);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(r.errors[0].message).toMatch(/e-way/);
  });
  it('reports missing columns', () => {
    expect(importTrips('trip_id,lr_no\nTRP-1,x', d).errors[0].message).toMatch(/Missing columns/);
  });
  it('parses quoted CSV cells', () => {
    expect(parseCsv('a,"b,c","d ""q"""\r\n1,2,3')).toEqual([['a', 'b,c', 'd "q"'], ['1', '2', '3']]);
  });
});
