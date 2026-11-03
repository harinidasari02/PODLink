/**
 * Deterministic synthetic sample data. Everything here is fictional: consignee names and
 * phone numbers are invented and use obviously fake number ranges.
 * ASSUMPTION (labelled in the TDD): branches, extra clients, vehicles and quantities are invented;
 * only the three sample trips and the company context come from the client brief.
 */
import type { BillingCycle, PodStatus } from './types';

export const ANCHOR = '2026-11-03'; // "today" for the seeded data

export const BRANCHES = ['Chhatrapati Sambhajinagar', 'Pune', 'Nagpur', 'Nashik'] as const;
export type Branch = (typeof BRANCHES)[number];

export const CLIENTS: { id: number; name: string; cycle: BillingCycle; ledger: string }[] = [
  { id: 1, name: 'Company B (cement)', cycle: 'weekly', ledger: 'Company B' },
  { id: 2, name: 'Company C (steel)', cycle: 'fortnightly', ledger: 'Company C' },
  { id: 3, name: 'Company D (packaged foods)', cycle: 'monthly', ledger: 'Company D' },
  { id: 4, name: 'Company E (cement)', cycle: 'weekly', ledger: 'Company E' },
  { id: 5, name: 'Company F (tiles)', cycle: 'fortnightly', ledger: 'Company F' },
];

const UNIT: Record<number, string> = { 1: 'bags', 2: 'tonnes', 3: 'cartons', 4: 'bags', 5: 'cartons' };
export function unitFor(clientId: number) { return UNIT[clientId] ?? 'units'; }

export const DRIVERS = [
  { code: 'D101', name: 'Ramesh Pawar', phone: '90000 00101', lang: 'mr', branch: 'Chhatrapati Sambhajinagar', vehicle: 'MH20 GT 7718' },
  { code: 'D102', name: 'Sunil Jadhav', phone: '90000 00102', lang: 'mr', branch: 'Chhatrapati Sambhajinagar', vehicle: 'MH20 EL 4521' },
  { code: 'D103', name: 'Imran Shaikh', phone: '90000 00103', lang: 'hi', branch: 'Pune', vehicle: 'MH12 QR 1180' },
  { code: 'D104', name: 'Dilip Kale', phone: '90000 00104', lang: 'mr', branch: 'Pune', vehicle: 'MH12 TS 6603' },
  { code: 'D105', name: 'Ajay Yadav', phone: '90000 00105', lang: 'hi', branch: 'Nagpur', vehicle: 'MH31 CV 2290' },
  { code: 'D106', name: 'Prakash Wagh', phone: '90000 00106', lang: 'mr', branch: 'Nashik', vehicle: 'MH15 HG 8847' },
] as const;

export const BILLING_USERS = [
  { email: 'billing@demo.podlink.test', name: 'Meera Kulkarni', branch: 'Chhatrapati Sambhajinagar' },
];

const DEST: Record<Branch, string[]> = {
  'Chhatrapati Sambhajinagar': ['Pune', 'Nagpur', 'Indore', 'Hyderabad'],
  Pune: ['Mumbai', 'Nashik', 'Kolhapur', 'Solapur'],
  Nagpur: ['Raipur', 'Jabalpur', 'Amravati', 'Akola'],
  Nashik: ['Surat', 'Ahmedabad', 'Thane', 'Dhule'],
};
const CONSIGNEES = [
  'Shree Ganesh Building Supplies', 'Mahalaxmi Steel Traders', 'Om Sai Distributors', 'Bharat Agro Stores',
  'Kalyani Hardware', 'Sunrise Retail Hub', 'Vijay Cement Depot', 'Anand Wholesale Mart',
  'Patil Industrial Supplies', 'Navkar Trading Co', 'Siddhivinayak Logistics Yard', 'Rajlaxmi Stores',
];

export type PodVariant = 'good' | 'blurry' | 'nostamp' | 'shortage';

export interface SeedTrip {
  id: string;
  lr_no: string;
  eway_bill_no: string;
  client_id: number;
  vehicle_no: string;
  hired: boolean;
  driver_code: string | null;
  origin: string;
  destination: string;
  branch: Branch;
  freight: number;
  qty: number;
  consignee_name: string;
  consignee_phone: string;
  dispatch_on: string;
  delivered_on: string | null;
  pod_status: PodStatus;
  retake_count: number;
  demo_scenario: 'clean' | 'shortage' | 'lowconf' | 'qtymismatch';
  remarks: string | null;
  // POD image + AI info when a POD exists
  pod?: { variant: PodVariant; received_on: string; extracted_qty: number | null; confidence: number; reasons: string[] };
  invoice?: { key: string; invoiced_on: string };
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const RESERVED = new Set(['TRP-66120', 'TRP-66134', 'TRP-66141', 'TRP-66150', 'TRP-66151', 'TRP-66152']);

export function buildSeedTrips(): SeedTrip[] {
  const rnd = mulberry32(2026);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const trips: SeedTrip[] = [];
  let n = 66100;

  const base = (over: Partial<SeedTrip> & { branch: Branch; client_id: number }): SeedTrip => {
    let id = over.id;
    if (!id) {
      while (RESERVED.has(`TRP-${n}`)) n++;
      id = `TRP-${n++}`;
    }
    const num = id.slice(4);
    const drivers = DRIVERS.filter((d) => d.branch === over.branch);
    const hired = over.hired ?? rnd() < 0.3;
    const drv = hired ? null : pick(drivers);
    const qty = over.qty ?? ({ 1: 500, 2: 18, 3: 120, 4: 480, 5: 300 }[over.client_id] ?? 100) + Math.floor(rnd() * 20);
    const t: SeedTrip = {
      id,
      lr_no: `LR-${over.branch.slice(0, 2).toUpperCase()}${num}`,
      eway_bill_no: `3910${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}`,
      vehicle_no: drv ? drv.vehicle : `MH17 ${pick(['BY', 'AZ', 'CK'])} ${3000 + Math.floor(rnd() * 6000)}`,
      hired,
      driver_code: drv ? drv.code : null,
      origin: over.branch === 'Chhatrapati Sambhajinagar' ? 'Chhatrapati Sambhajinagar' : over.branch,
      destination: pick(DEST[over.branch]),
      freight: 18000 + Math.floor(rnd() * 28) * 1000,
      qty,
      consignee_name: pick(CONSIGNEES),
      consignee_phone: `90000 ${String(10000 + Math.floor(rnd() * 89999)).slice(0, 5)}`,
      dispatch_on: ANCHOR,
      delivered_on: null,
      pod_status: 'none',
      retake_count: 0,
      demo_scenario: 'clean',
      remarks: null,
      ...over,
    };
    return t;
  };

  // ---- the three trips given in the client brief (exact values) ----
  trips.push(base({
    id: 'TRP-66120', branch: 'Chhatrapati Sambhajinagar', client_id: 1, hired: false, driver_code: 'D102',
    vehicle_no: 'MH20 EL 4521', destination: 'Nagpur', freight: 38500, qty: 500,
    dispatch_on: '2026-10-28', delivered_on: '2026-10-30', pod_status: 'verified', remarks: null,
    pod: { variant: 'good', received_on: '2026-10-30', extracted_qty: 500, confidence: 0.94, reasons: [] },
  }));
  trips.push(base({
    id: 'TRP-66134', branch: 'Chhatrapati Sambhajinagar', client_id: 2, hired: false, driver_code: 'D101',
    vehicle_no: 'MH20 GT 7718', destination: 'Pune', freight: 26000, qty: 18,
    dispatch_on: '2026-10-30', delivered_on: '2026-11-01', pod_status: 'retake_requested', retake_count: 1,
    remarks: 'Stamp not visible',
    pod: { variant: 'nostamp', received_on: '2026-11-01', extracted_qty: 18, confidence: 0.88, reasons: ['stamp_missing'] },
  }));
  trips.push(base({
    id: 'TRP-66141', branch: 'Chhatrapati Sambhajinagar', client_id: 3, hired: true, driver_code: null,
    vehicle_no: 'MH17 BY 3092', destination: 'Indore', freight: 41200, qty: 120,
    dispatch_on: '2026-10-29', delivered_on: '2026-11-01', pod_status: 'needs_review', demo_scenario: 'shortage',
    remarks: 'Short by 6 cartons',
    pod: { variant: 'shortage', received_on: '2026-11-02', extracted_qty: 114, confidence: 0.9, reasons: ['shortage_or_damage', 'qty_mismatch'] },
  }));
  n = 66142;

  // ---- billed history: slow legacy paper flow (baseline ~18 days) and a few fast ones ----
  const billedPlan: { branch: Branch; client: number; delivered: string; podLag: number; invLag: number }[] = [
    { branch: 'Chhatrapati Sambhajinagar', client: 1, delivered: '2026-09-22', podLag: 11, invLag: 7 },
    { branch: 'Chhatrapati Sambhajinagar', client: 1, delivered: '2026-09-24', podLag: 12, invLag: 5 },
    { branch: 'Pune', client: 2, delivered: '2026-09-26', podLag: 14, invLag: 6 },
    { branch: 'Pune', client: 2, delivered: '2026-09-28', podLag: 10, invLag: 8 },
    { branch: 'Nagpur', client: 4, delivered: '2026-09-29', podLag: 15, invLag: 5 },
    { branch: 'Nagpur', client: 4, delivered: '2026-10-01', podLag: 13, invLag: 6 },
    { branch: 'Nashik', client: 3, delivered: '2026-10-02', podLag: 16, invLag: 4 },
    { branch: 'Nashik', client: 5, delivered: '2026-10-03', podLag: 12, invLag: 7 },
    { branch: 'Chhatrapati Sambhajinagar', client: 5, delivered: '2026-10-09', podLag: 1, invLag: 3 },
    { branch: 'Pune', client: 1, delivered: '2026-10-12', podLag: 1, invLag: 2 },
    { branch: 'Nagpur', client: 3, delivered: '2026-10-14', podLag: 0, invLag: 3 },
    { branch: 'Nashik', client: 4, delivered: '2026-10-15', podLag: 1, invLag: 2 },
  ];
  for (const b of billedPlan) {
    const recv = addDays(b.delivered, b.podLag);
    const inv = addDays(recv, b.invLag);
    trips.push(base({
      branch: b.branch, client_id: b.client, dispatch_on: addDays(b.delivered, -2), delivered_on: b.delivered, pod_status: 'billed',
      pod: { variant: 'good', received_on: recv, extracted_qty: null, confidence: 0.92, reasons: [] },
      invoice: { key: `${b.client}-${inv.slice(0, 7)}-${b.client % 2}`, invoiced_on: inv },
    }));
  }

  // ---- verified, ready to bill ----
  const verifiedPlan: [Branch, number, string][] = [
    ['Chhatrapati Sambhajinagar', 1, '2026-10-26'], ['Chhatrapati Sambhajinagar', 1, '2026-10-27'],
    ['Chhatrapati Sambhajinagar', 2, '2026-10-28'], ['Chhatrapati Sambhajinagar', 3, '2026-10-29'],
    ['Pune', 1, '2026-10-27'], ['Pune', 2, '2026-10-29'], ['Pune', 5, '2026-10-30'],
    ['Nagpur', 4, '2026-10-28'], ['Nagpur', 4, '2026-10-30'], ['Nagpur', 3, '2026-10-31'],
    ['Nashik', 5, '2026-10-29'], ['Nashik', 4, '2026-11-01'], ['Nashik', 1, '2026-11-01'],
    ['Pune', 3, '2026-11-02'],
  ];
  for (const [branch, client, delivered] of verifiedPlan) {
    trips.push(base({
      branch, client_id: client, dispatch_on: addDays(delivered, -2), delivered_on: delivered, pod_status: 'verified',
      pod: { variant: 'good', received_on: delivered, extracted_qty: null, confidence: 0.9 + rnd() * 0.07, reasons: [] },
    }));
  }

  // ---- needs review (besides TRP-66141) ----
  const reviewPlan: { branch: Branch; client: number; delivered: string; scenario: SeedTrip['demo_scenario']; variant: PodVariant; reasons: string[]; conf: number; qtyDelta: number; remarks: string }[] = [
    { branch: 'Pune', client: 1, delivered: '2026-10-31', scenario: 'qtymismatch', variant: 'good', reasons: ['qty_mismatch'], conf: 0.86, qtyDelta: -10, remarks: 'Quantity differs from the trip record' },
    { branch: 'Nagpur', client: 4, delivered: '2026-11-01', scenario: 'lowconf', variant: 'good', reasons: ['low_confidence'], conf: 0.61, qtyDelta: 0, remarks: 'AI is not confident about this reading' },
    { branch: 'Nashik', client: 5, delivered: '2026-10-30', scenario: 'shortage', variant: 'shortage', reasons: ['shortage_or_damage', 'qty_mismatch'], conf: 0.91, qtyDelta: -12, remarks: 'Damaged cartons noted by consignee' },
    { branch: 'Chhatrapati Sambhajinagar', client: 2, delivered: '2026-10-29', scenario: 'lowconf', variant: 'nostamp', reasons: ['stamp_missing', 'retake_cap'], conf: 0.7, qtyDelta: 0, remarks: 'Retake limit reached, sent to a person' },
  ];
  for (const r of reviewPlan) {
    const t = base({
      branch: r.branch, client_id: r.client, dispatch_on: addDays(r.delivered, -2), delivered_on: r.delivered,
      pod_status: 'needs_review', demo_scenario: r.scenario, retake_count: r.reasons.includes('retake_cap') ? 2 : 0, remarks: r.remarks,
    });
    t.pod = { variant: r.variant, received_on: r.delivered, extracted_qty: t.qty + r.qtyDelta, confidence: r.conf, reasons: r.reasons };
    trips.push(t);
  }

  // ---- retake requested (besides TRP-66134) ----
  {
    const t = base({
      branch: 'Pune', client_id: 1, dispatch_on: '2026-10-30', delivered_on: '2026-11-01', pod_status: 'retake_requested',
      retake_count: 1, remarks: 'Photo is blurry',
    });
    t.pod = { variant: 'blurry', received_on: '2026-11-01', extracted_qty: null, confidence: 0.5, reasons: ['quality_blurry'] };
    trips.push(t);
  }

  // ---- delivered, no POD yet (ages 1..23 days) ----
  const missingPlan: [Branch, number, number][] = [
    ['Chhatrapati Sambhajinagar', 1, 2], ['Chhatrapati Sambhajinagar', 2, 6], ['Chhatrapati Sambhajinagar', 3, 12],
    ['Chhatrapati Sambhajinagar', 4, 19], ['Pune', 1, 3], ['Pune', 5, 9], ['Pune', 3, 15], ['Nagpur', 4, 4],
    ['Nagpur', 1, 11], ['Nagpur', 2, 23], ['Nashik', 5, 7], ['Nashik', 4, 17],
  ];
  for (const [branch, client, age] of missingPlan) {
    trips.push(base({ branch, client_id: client, dispatch_on: addDays(ANCHOR, -age - 2), delivered_on: addDays(ANCHOR, -age) }));
  }

  // ---- Ramesh's (D101) demo trips: one he can photograph right now, one still on the road ----
  trips.push(base({
    id: 'TRP-66150', branch: 'Chhatrapati Sambhajinagar', client_id: 1, hired: false, driver_code: 'D101', vehicle_no: 'MH20 GT 7718',
    destination: 'Nagpur', qty: 500, freight: 36500, dispatch_on: '2026-11-01', delivered_on: '2026-11-03',
    consignee_name: 'Vijay Cement Depot',
  }));
  trips.push(base({
    id: 'TRP-66151', branch: 'Chhatrapati Sambhajinagar', client_id: 3, hired: false, driver_code: 'D101', vehicle_no: 'MH20 GT 7718',
    destination: 'Indore', qty: 120, freight: 40200, dispatch_on: '2026-11-03', delivered_on: null,
    consignee_name: 'Anand Wholesale Mart', demo_scenario: 'clean',
  }));
  // hired-truck trip for the SMS-link demo (no app, no login)
  trips.push(base({
    id: 'TRP-66152', branch: 'Pune', client_id: 2, hired: true, driver_code: null, vehicle_no: 'MH17 CK 5521',
    destination: 'Mumbai', qty: 18, freight: 28500, dispatch_on: '2026-10-31', delivered_on: '2026-11-02',
    consignee_name: 'Mahalaxmi Steel Traders',
  }));

  const ids = new Set(trips.map((t) => t.id));
  if (ids.size !== trips.length) throw new Error('Duplicate seed trip ids');
  return trips;
}
