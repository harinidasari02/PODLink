// Generates SYNTHETIC lorry-receipt photos (no real data) for the seed and for reviewer test uploads.
// Run once: `npm run assets`. Output is committed (seed-assets/, public/samples/).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { buildSeedTrips, CLIENTS, unitFor, type PodVariant, type SeedTrip } from '../src/lib/seed-data';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svgFor(t: SeedTrip, variant: PodVariant, opts: { qty: number; remark: string | null }) {
  const client = CLIENTS.find((c) => c.id === t.client_id)!.name;
  const unit = unitFor(t.client_id);
  const stamp = variant !== 'nostamp';
  const date = (t.delivered_on ?? '2026-11-03').split('-').reverse().join('/');
  const rot = (t.id.charCodeAt(t.id.length - 1) % 7) - 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#5b5f66"/>
  <g transform="rotate(${rot} 450 600)">
  <rect x="60" y="50" width="780" height="1100" fill="#f4f1e8" stroke="#bdb8a8" stroke-width="3"/>
  <text x="100" y="120" font-family="DejaVu Sans, sans-serif" font-size="34" font-weight="700" fill="#222">COMPANY A TRANSPORT (DEMO)</text>
  <text x="100" y="158" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#444">LORRY RECEIPT / PROOF OF DELIVERY</text>
  <line x1="100" y1="180" x2="800" y2="180" stroke="#222" stroke-width="3"/>
  <g font-family="DejaVu Sans, sans-serif" font-size="26" fill="#111">
    <text x="100" y="240">LR No.</text><text x="320" y="240" font-weight="700">${esc(t.lr_no)}</text>
    <text x="100" y="300">Consignor</text><text x="320" y="300">${esc(client)}</text>
    <text x="100" y="360">Consignee</text><text x="320" y="360">${esc(t.consignee_name)}</text>
    <text x="100" y="420">Vehicle</text><text x="320" y="420">${esc(t.vehicle_no)}</text>
    <text x="100" y="480">To</text><text x="320" y="480">${esc(t.destination)}</text>
    <text x="100" y="540">Quantity</text><text x="320" y="540" font-weight="700">${opts.qty} ${unit}</text>
    <text x="100" y="600">Delivered on</text><text x="320" y="600">${date}</text>
  </g>
  <g stroke="#999" stroke-width="2" fill="none">
    <rect x="100" y="650" width="700" height="150"/><line x1="100" y1="700" x2="800" y2="700"/><line x1="450" y1="650" x2="450" y2="800"/>
  </g>
  <text x="115" y="685" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#555">Goods description</text>
  <text x="465" y="685" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#555">Remarks</text>
  <text x="115" y="750" font-family="DejaVu Sans, sans-serif" font-size="24" fill="#222">${unit} as per e-way bill</text>
  <text x="465" y="750" font-family="DejaVu Sans, sans-serif" font-size="26" font-style="italic" fill="#1a2a6c">${esc(opts.remark ?? '')}</text>
  ${stamp ? `<g transform="rotate(-12 600 930)" fill="none" stroke="#1b3fa8" stroke-width="5">
    <circle cx="600" cy="930" r="105"/><circle cx="600" cy="930" r="88" stroke-width="2"/>
    <text x="600" y="918" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="22" font-weight="700" fill="#1b3fa8" stroke="none">RECEIVED</text>
    <text x="600" y="948" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#1b3fa8" stroke="none">${esc(t.consignee_name.slice(0, 22))}</text>
    <text x="600" y="974" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#1b3fa8" stroke="none">${date}</text></g>` : ''}
  <path d="M130 960 q30 -70 55 -10 t50 -5 t45 -40 t40 30 t45 -25" stroke="#0b1b5c" stroke-width="4" fill="none"/>
  <text x="130" y="1010" font-family="DejaVu Sans, sans-serif" font-size="18" fill="#555">Consignee signature</text>
  <text x="560" y="1090" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#777">E-way bill ${esc(t.eway_bill_no)}</text>
  </g></svg>`;
}

async function render(t: SeedTrip, variant: PodVariant, qty: number, remark: string | null, out: string) {
  let img = sharp(Buffer.from(svgFor(t, variant, { qty, remark }))).jpeg({ quality: 70 });
  if (variant === 'blurry') {
    img = sharp(await sharp(Buffer.from(svgFor(t, variant, { qty, remark }))).blur(9).jpeg({ quality: 60 }).toBuffer()).jpeg({ quality: 60 });
  }
  let buf = await img.toBuffer();
  for (let q = 70; buf.length > 280 * 1024 && q > 30; q -= 10) buf = await sharp(buf).jpeg({ quality: q }).toBuffer();
  fs.writeFileSync(out, buf);
  return buf.length;
}

async function main() {
const root = path.join(process.cwd());
fs.mkdirSync(path.join(root, 'seed-assets'), { recursive: true });
fs.mkdirSync(path.join(root, 'public', 'samples'), { recursive: true });
const trips = buildSeedTrips();
let count = 0;
for (const t of trips) {
  if (!t.pod) continue;
  const remark = t.pod.variant === 'shortage' ? (t.remarks ?? 'Short / damaged') : null;
  await render(t, t.pod.variant, t.pod.extracted_qty ?? t.qty, remark, path.join(root, 'seed-assets', `${t.id}.jpg`));
  count++;
}
// reviewer test photos for the demo driver's trips
const t150 = trips.find((t) => t.id === 'TRP-66150')!;
const t134 = trips.find((t) => t.id === 'TRP-66134')!;
const t152 = trips.find((t) => t.id === 'TRP-66152')!;
const samples: [SeedTrip, PodVariant, string][] = [
  [t150, 'good', 'TRP-66150-good'], [t150, 'blurry', 'TRP-66150-blurry'], [t150, 'nostamp', 'TRP-66150-no-stamp'],
  [t134, 'good', 'TRP-66134-good'], [t152, 'good', 'TRP-66152-good'],
];
for (const [t, v, name] of samples) {
  const size = await render(t, v, t.qty, null, path.join(root, 'public', 'samples', `${name}.jpg`));
  console.log(name, Math.round(size / 1024) + ' KB');
}
console.log(`generated ${count} seed images`);
}
main().catch((e) => { console.error(e); process.exit(1); });
