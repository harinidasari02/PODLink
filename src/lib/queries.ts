import type Database from 'better-sqlite3';
import { db } from './db';
import { cycleKey, daysBetween } from './cycles';
import { unitFor, ANCHOR } from './seed-data';
import { MAX_RETAKES, REASON_TEXT } from './pod-rules';
import type { BillingCycle } from './types';

export const todayIso = () => new Date().toISOString().slice(0, 10);

export interface DriverTrip {
  id: string; lr_no: string; client: string; destination: string; qty: number; unit: string;
  pod_status: string; retakes_left: number; delivered_on: string | null; retake_reasons: string[];
}

function lastReasons(d: Database.Database, tripId: string): string[] {
  const row = d.prepare('SELECT reasons_json FROM pod_submissions WHERE trip_id = ? ORDER BY id DESC LIMIT 1').get(tripId) as { reasons_json: string } | undefined;
  return row ? (JSON.parse(row.reasons_json) as string[]) : [];
}

export function driverTrips(userId: number, d: Database.Database = db()): DriverTrip[] {
  const rows = d.prepare(`SELECT t.id, t.lr_no, c.name AS client, t.destination, t.qty, t.client_id, t.pod_status, t.retake_count, t.delivered_on, t.remarks
      FROM trips t JOIN clients c ON c.id = t.client_id
      WHERE t.driver_id = ? AND t.pod_status != 'billed'
      ORDER BY CASE t.pod_status WHEN 'retake_requested' THEN 0 WHEN 'none' THEN 1 WHEN 'needs_review' THEN 2 ELSE 3 END, t.dispatch_on DESC`).all(userId) as
    { id: string; lr_no: string; client: string; destination: string; qty: number; client_id: number; pod_status: string; retake_count: number; delivered_on: string | null; remarks: string | null }[];
  return rows.map((r) => ({
    id: r.id, lr_no: r.lr_no, client: r.client, destination: r.destination, qty: r.qty, unit: unitFor(r.client_id),
    pod_status: r.pod_status, retakes_left: Math.max(0, MAX_RETAKES - r.retake_count), delivered_on: r.delivered_on,
    retake_reasons: r.pod_status === 'retake_requested' ? lastReasons(d, r.id) : [],
  }));
}

export interface ReviewItem {
  trip_id: string; lr_no: string; client: string; destination: string; branch: string; freight: number;
  reasons: string[]; submission_id: number | null; received_at: string | null; confidence: number | null;
}

export function reviewQueue(d: Database.Database = db()): ReviewItem[] {
  const rows = d.prepare(`SELECT t.id AS trip_id, t.lr_no, c.name AS client, t.destination, t.branch, t.freight,
      s.id AS submission_id, s.received_at, s.reasons_json, s.extraction_json
      FROM trips t JOIN clients c ON c.id = t.client_id
      LEFT JOIN pod_submissions s ON s.id = (SELECT MAX(id) FROM pod_submissions WHERE trip_id = t.id)
      WHERE t.pod_status = 'needs_review' ORDER BY s.received_at ASC`).all() as
    { trip_id: string; lr_no: string; client: string; destination: string; branch: string; freight: number; submission_id: number | null; received_at: string | null; reasons_json: string | null; extraction_json: string | null }[];
  return rows.map((r) => ({
    trip_id: r.trip_id, lr_no: r.lr_no, client: r.client, destination: r.destination, branch: r.branch, freight: r.freight,
    reasons: r.reasons_json ? (JSON.parse(r.reasons_json) as string[]) : [], submission_id: r.submission_id, received_at: r.received_at,
    confidence: r.extraction_json ? (JSON.parse(r.extraction_json) as { confidence: number }).confidence : null,
  }));
}

export function maskPhone(p: string | null): string {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  return digits.length < 6 ? '••••' : `${digits.slice(0, 2)}•••••${digits.slice(-3)}`;
}

export interface TripFull {
  id: string; lr_no: string; eway_bill_no: string; client_id: number; client: string; billing_cycle: BillingCycle;
  vehicle_no: string; hired: number; origin: string; destination: string; branch: string; freight: number; qty: number; unit: string;
  consignee_name: string; consignee_phone: string; dispatch_on: string; delivered_on: string | null;
  pod_status: string; retake_count: number; remarks: string | null; demo_scenario: string; invoice_id: number | null;
}

export function tripDetail(tripId: string, d: Database.Database = db()) {
  const raw = d.prepare(`SELECT t.*, c.name AS client, c.billing_cycle FROM trips t JOIN clients c ON c.id = t.client_id WHERE t.id = ?`).get(tripId) as
    (Omit<TripFull, 'unit'> & { consignee_phone: string | null }) | undefined;
  if (!raw) return null;
  const trip: TripFull = { ...raw, consignee_phone: maskPhone(raw.consignee_phone), unit: unitFor(raw.client_id) };
  const subs = d.prepare('SELECT * FROM pod_submissions WHERE trip_id = ? ORDER BY id DESC').all(tripId) as
    { id: number; received_at: string; captured_at: string; lat: number | null; lng: number | null; captured_offline: number; source: string; ai_mode: string; extraction_json: string | null; decision: string; reasons_json: string; size_bytes: number }[];
  return {
    trip,
    submissions: subs.map((s) => ({ ...s, reasons: JSON.parse(s.reasons_json) as string[], extraction: s.extraction_json ? JSON.parse(s.extraction_json) : null })),
  };
}

export interface QueueGroup {
  key: string; client_id: number; client: string; cycle: BillingCycle; cycle_label: string; total: number;
  trips: { id: string; lr_no: string; destination: string; freight: number; delivered_on: string; branch: string; waiting_days: number; submission_id: number | null }[];
}

/** Verified trips grouped by client and billing cycle (cycle comes from the delivery date). */
export function billingQueue(d: Database.Database = db(), today = todayIso()): QueueGroup[] {
  const rows = d.prepare(`SELECT t.id, t.lr_no, t.destination, t.freight, t.delivered_on, t.branch, t.pod_received_at, t.client_id, c.name AS client, c.billing_cycle,
      (SELECT MAX(id) FROM pod_submissions WHERE trip_id = t.id) AS submission_id
      FROM trips t JOIN clients c ON c.id = t.client_id WHERE t.pod_status = 'verified' AND t.delivered_on IS NOT NULL ORDER BY t.delivered_on`).all() as
    { id: string; lr_no: string; destination: string; freight: number; delivered_on: string; branch: string; pod_received_at: string | null; client_id: number; client: string; billing_cycle: BillingCycle; submission_id: number | null }[];
  const groups = new Map<string, QueueGroup>();
  for (const r of rows) {
    const label = cycleKey(r.delivered_on, r.billing_cycle);
    const key = `${r.client_id}|${label}`;
    const g = groups.get(key) ?? { key, client_id: r.client_id, client: r.client, cycle: r.billing_cycle, cycle_label: label, total: 0, trips: [] };
    g.total += r.freight;
    g.trips.push({ id: r.id, lr_no: r.lr_no, destination: r.destination, freight: r.freight, delivered_on: r.delivered_on, branch: r.branch,
      waiting_days: Math.max(0, daysBetween((r.pod_received_at ?? r.delivered_on).slice(0, 10), today)), submission_id: r.submission_id });
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.client.localeCompare(b.client) || a.cycle_label.localeCompare(b.cycle_label));
}

export interface BranchRow { branch: string; missing: number; review: number; ready: number; avg_days: number | null; invoiced: number }
export interface MissingTrip { id: string; lr_no: string; client: string; branch: string; vehicle_no: string; hired: boolean; days: number; status: string; destination: string }

export function dashboard(d: Database.Database = db(), today = todayIso()) {
  const missingRows = d.prepare(`SELECT t.id, t.lr_no, c.name AS client, t.branch, t.vehicle_no, t.hired, t.delivered_on, t.pod_status, t.destination
      FROM trips t JOIN clients c ON c.id = t.client_id
      WHERE t.delivered_on IS NOT NULL AND t.pod_status IN ('none','retake_requested') ORDER BY t.delivered_on ASC`).all() as
    { id: string; lr_no: string; client: string; branch: string; vehicle_no: string; hired: number; delivered_on: string; pod_status: string; destination: string }[];
  const missing: MissingTrip[] = missingRows.map((r) => ({
    id: r.id, lr_no: r.lr_no, client: r.client, branch: r.branch, vehicle_no: r.vehicle_no, hired: !!r.hired,
    days: Math.max(0, daysBetween(r.delivered_on, today)), status: r.pod_status, destination: r.destination,
  }));

  const branches = (d.prepare('SELECT DISTINCT branch FROM trips ORDER BY branch').all() as { branch: string }[]).map((b) => b.branch);
  const byBranch: BranchRow[] = branches.map((branch) => {
    const cnt = (status: string) => (d.prepare("SELECT COUNT(*) c FROM trips WHERE branch = ? AND pod_status = ?").get(branch, status) as { c: number }).c;
    const inv = d.prepare(`SELECT t.pod_received_at, i.created_at FROM trips t JOIN invoices i ON i.id = t.invoice_id WHERE t.branch = ? AND t.pod_received_at IS NOT NULL`).all(branch) as { pod_received_at: string; created_at: string }[];
    const days = inv.map((r) => daysBetween(r.pod_received_at, r.created_at));
    return {
      branch, missing: missing.filter((m) => m.branch === branch).length, review: cnt('needs_review'), ready: cnt('verified'),
      avg_days: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null, invoiced: days.length,
    };
  });

  const allDays = (d.prepare(`SELECT t.pod_received_at, i.created_at FROM trips t JOIN invoices i ON i.id = t.invoice_id WHERE t.pod_received_at IS NOT NULL`).all() as { pod_received_at: string; created_at: string }[])
    .map((r) => daysBetween(r.pod_received_at, r.created_at));
  const avg = allDays.length ? Math.round((allDays.reduce((a, b) => a + b, 0) / allDays.length) * 10) / 10 : null;

  const aging = [
    { label: '0–3 days', n: missing.filter((m) => m.days <= 3).length },
    { label: '4–10 days', n: missing.filter((m) => m.days >= 4 && m.days <= 10).length },
    { label: '11–20 days', n: missing.filter((m) => m.days >= 11 && m.days <= 20).length },
    { label: '20+ days', n: missing.filter((m) => m.days > 20).length },
  ];
  const total = (d.prepare('SELECT COUNT(*) c FROM trips WHERE delivered_on IS NOT NULL').get() as { c: number }).c;
  const withPod = (d.prepare("SELECT COUNT(*) c FROM trips WHERE delivered_on IS NOT NULL AND pod_status IN ('needs_review','verified','billed')").get() as { c: number }).c;
  return {
    kpi: {
      missing: missing.length,
      review: (d.prepare("SELECT COUNT(*) c FROM trips WHERE pod_status = 'needs_review'").get() as { c: number }).c,
      ready: (d.prepare("SELECT COUNT(*) c FROM trips WHERE pod_status = 'verified'").get() as { c: number }).c,
      avg_days: avg, coverage: total ? Math.round((withPod / total) * 100) : 0,
    },
    byBranch, aging, missing,
  };
}

export function recentInvoices(d: Database.Database = db()) {
  return d.prepare(`SELECT i.id, i.number, i.cycle_label, i.total, i.created_at, i.share_token, c.name AS client,
      (SELECT COUNT(*) FROM trips WHERE invoice_id = i.id) AS trip_count FROM invoices i JOIN clients c ON c.id = i.client_id
      ORDER BY i.id DESC LIMIT 8`).all() as { id: number; number: string; cycle_label: string; total: number; created_at: string; share_token: string; client: string; trip_count: number }[];
}

export const reasonLabel = (code: string) => REASON_TEXT[code] ?? code;
void ANCHOR;
