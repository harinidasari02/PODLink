import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { BILLING_USERS, BRANCHES, CLIENTS, DRIVERS, buildSeedTrips } from './seed-data';
import { cycleKey } from './cycles';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'podlink.db');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');
const SEED_ASSETS = path.join(process.cwd(), 'seed-assets');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('driver','billing')),
  name TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,          -- driver code (D101) or billing email
  secret_hash TEXT NOT NULL,           -- bcrypt of 4-digit PIN (driver) or password (billing)
  phone TEXT,
  lang TEXT NOT NULL DEFAULT 'hi',
  branch TEXT
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly','fortnightly','monthly')),
  tally_ledger TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,                 -- TRP-66120
  lr_no TEXT NOT NULL UNIQUE,
  eway_bill_no TEXT NOT NULL,          -- every trip links to its e-way bill
  client_id INTEGER NOT NULL REFERENCES clients(id),
  vehicle_no TEXT NOT NULL,
  hired INTEGER NOT NULL DEFAULT 0,
  driver_id INTEGER REFERENCES users(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  branch TEXT NOT NULL,
  freight INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  consignee_name TEXT NOT NULL,        -- personal data (DPDP Act 2023)
  consignee_phone TEXT,                -- personal data (DPDP Act 2023)
  dispatch_on TEXT NOT NULL,
  delivered_on TEXT,
  pod_status TEXT NOT NULL DEFAULT 'none'
    CHECK (pod_status IN ('none','retake_requested','needs_review','verified','billed')),
  retake_count INTEGER NOT NULL DEFAULT 0,
  pod_received_at TEXT,
  remarks TEXT,
  demo_scenario TEXT NOT NULL DEFAULT 'clean',
  invoice_id INTEGER REFERENCES invoices(id)
);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(pod_status);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE TABLE IF NOT EXISTS pod_submissions (
  id INTEGER PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  image_file TEXT NOT NULL,            -- generated name inside UPLOAD_DIR, never user-controlled
  size_bytes INTEGER NOT NULL,
  captured_at TEXT NOT NULL,           -- device time at capture
  received_at TEXT NOT NULL,           -- server time at upload
  lat REAL, lng REAL, accuracy_m REAL,
  captured_offline INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'app',  -- app | sms_link | seed
  ai_mode TEXT NOT NULL,               -- vision | mock | none
  extraction_json TEXT,                -- what the AI read (the image remains the source of truth)
  decision TEXT NOT NULL,              -- verified | retake | needs_review
  reasons_json TEXT NOT NULL DEFAULT '[]',
  corrected_json TEXT                  -- fields corrected by a billing executive
);
CREATE INDEX IF NOT EXISTS idx_sub_trip ON pod_submissions(trip_id);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  cycle_label TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  total INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  share_token TEXT UNIQUE              -- read-only client link to view PODs
);
CREATE TABLE IF NOT EXISTS sms_links (
  token TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  phone TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  trip_id TEXT,
  detail TEXT
);
`;

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  d.exec(SCHEMA);
  const empty = (d.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c === 0;
  if (empty && process.env.AUTO_SEED !== 'false') seedDatabase(d);
  _db = d;
  return d;
}

/** Test helper / seed script: build a fresh in-memory-capable DB. */
export function openDb(file: string): Database.Database {
  const d = new Database(file);
  d.pragma('foreign_keys = ON');
  d.exec(SCHEMA);
  return d;
}

export function audit(actor: string, action: string, tripId: string | null, detail?: unknown) {
  db().prepare('INSERT INTO audit_log (at, actor, action, trip_id, detail) VALUES (?,?,?,?,?)')
    .run(new Date().toISOString(), actor, action, tripId, detail ? JSON.stringify(detail) : null);
}

export function seedDatabase(d: Database.Database) {
  // Demo credentials are published in deployment.md. They are for synthetic data only.
  const pinHash = bcrypt.hashSync('1234', 8);
  const pwHash = bcrypt.hashSync('demo-pass-2026', 8);

  const tx = d.transaction(() => {
    const insUser = d.prepare('INSERT INTO users (role,name,login,secret_hash,phone,lang,branch) VALUES (?,?,?,?,?,?,?)');
    const driverIds = new Map<string, number>();
    for (const dr of DRIVERS) {
      const r = insUser.run('driver', dr.name, dr.code, pinHash, dr.phone, dr.lang, dr.branch);
      driverIds.set(dr.code, Number(r.lastInsertRowid));
    }
    let billingId = 0;
    for (const b of BILLING_USERS) {
      billingId = Number(insUser.run('billing', b.name, b.email, pwHash, null, 'en', b.branch).lastInsertRowid);
    }
    const insClient = d.prepare('INSERT INTO clients (id,name,billing_cycle,tally_ledger) VALUES (?,?,?,?)');
    for (const c of CLIENTS) insClient.run(c.id, c.name, c.cycle, c.ledger);

    const insTrip = d.prepare(`INSERT INTO trips
      (id,lr_no,eway_bill_no,client_id,vehicle_no,hired,driver_id,origin,destination,branch,freight,qty,
       consignee_name,consignee_phone,dispatch_on,delivered_on,pod_status,retake_count,pod_received_at,remarks,demo_scenario,invoice_id)
      VALUES (@id,@lr_no,@eway,@client_id,@vehicle_no,@hired,@driver_id,@origin,@destination,@branch,@freight,@qty,
       @consignee_name,@consignee_phone,@dispatch_on,@delivered_on,@pod_status,@retake_count,@pod_received_at,@remarks,@demo_scenario,@invoice_id)`);
    const insSub = d.prepare(`INSERT INTO pod_submissions
      (trip_id,image_file,size_bytes,captured_at,received_at,source,ai_mode,extraction_json,decision,reasons_json)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const insInv = d.prepare('INSERT INTO invoices (client_id,cycle_label,number,total,created_by,created_at,share_token) VALUES (?,?,?,?,?,?,?)');

    const trips = buildSeedTrips();
    const invoiceIds = new Map<string, number>();
    const byInvoice = new Map<string, typeof trips>();
    for (const t of trips) if (t.invoice) {
      const arr = byInvoice.get(t.invoice.key) ?? [];
      arr.push(t);
      byInvoice.set(t.invoice.key, arr);
    }
    let invNo = 1;
    for (const [key, list] of byInvoice) {
      const total = list.reduce((s, t) => s + t.freight, 0);
      const client = CLIENTS.find((c) => c.id === list[0].client_id)!;
      const last = list.map((t) => t.invoice!.invoiced_on).sort().pop()!;
      const label = cycleKey(list[0].delivered_on!, client.cycle);
      const r = insInv.run(client.id, label, `INV-2026-${String(invNo++).padStart(4, '0')}`, total, billingId, last + 'T10:00:00.000Z', `seed${key.replace(/[^a-z0-9]/gi, '')}`.slice(0, 24));
      invoiceIds.set(key, Number(r.lastInsertRowid));
    }

    for (const t of trips) {
      const receivedAt = t.pod ? t.pod.received_on + 'T09:30:00.000Z' : null;
      insTrip.run({
        id: t.id, lr_no: t.lr_no, eway: t.eway_bill_no, client_id: t.client_id, vehicle_no: t.vehicle_no,
        hired: t.hired ? 1 : 0, driver_id: t.driver_code ? driverIds.get(t.driver_code)! : null,
        origin: t.origin, destination: t.destination, branch: t.branch, freight: t.freight, qty: t.qty,
        consignee_name: t.consignee_name, consignee_phone: t.consignee_phone, dispatch_on: t.dispatch_on,
        delivered_on: t.delivered_on, pod_status: t.pod_status, retake_count: t.retake_count,
        pod_received_at: receivedAt, remarks: t.remarks, demo_scenario: t.demo_scenario,
        invoice_id: t.invoice ? invoiceIds.get(t.invoice.key)! : null,
      });
      if (t.pod) {
        const src = path.join(SEED_ASSETS, `${t.id}.jpg`);
        const file = `seed-${t.id}.jpg`;
        let size = 0;
        if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(UPLOAD_DIR, file)); size = fs.statSync(src).size; }
        const decision = t.pod_status === 'retake_requested' ? 'retake' : t.pod_status === 'needs_review' ? 'needs_review' : 'verified';
        const ex = {
          lr_number: t.lr_no, consignee_stamp: t.pod.variant !== 'nostamp', quantity: t.pod.extracted_qty ?? t.qty,
          remarks: t.remarks, shortage_or_damage: t.pod.variant === 'shortage', delivery_date: t.delivered_on,
          signature: true, image_quality: t.pod.variant === 'blurry' ? 'blurry' : 'ok', confidence: t.pod.confidence,
        };
        insSub.run(t.id, file, size, receivedAt, receivedAt, 'seed', 'mock', JSON.stringify(ex), decision, JSON.stringify(t.pod.reasons));
      }
    }
  });
  tx();
  void BRANCHES;
}
