import Link from 'next/link';
import { notFound } from 'next/navigation';
import { tripDetail, reasonLabel } from '@/lib/queries';
import { Icon, StatusPill, inr, fmtDate } from '@/components/ui';
import { ReviewPanel } from './ReviewPanel';
import { MAX_RETAKES } from '@/lib/pod-rules';

export const metadata = { title: 'Review POD' };

const yn = (b: boolean) => (b ? 'Seen' : 'Not seen');

export default async function ReviewDetail({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const data = tripDetail(tripId);
  if (!data) notFound();
  const { trip, submissions } = data;
  const latest = submissions[0];
  const ex = latest?.extraction as null | { lr_number: string | null; consignee_stamp: boolean; signature: boolean; quantity: number | null; remarks: string | null; delivery_date: string | null; confidence: number };
  const t = trip as unknown as Record<string, string | number | null>;
  const rows: [string, string, boolean | null][] = ex ? [
    ['LR number', ex.lr_number ?? 'Not readable', ex.lr_number ? ex.lr_number.replace(/\W/g, '').toUpperCase() === String(t.lr_no).replace(/\W/g, '').toUpperCase() : false],
    ['Quantity', ex.quantity == null ? 'Not readable' : `${ex.quantity} ${t.unit}`, ex.quantity === t.qty],
    ['Consignee stamp', yn(ex.consignee_stamp), ex.consignee_stamp],
    ['Signature', yn(ex.signature), ex.signature],
    ['Delivery date', ex.delivery_date ? fmtDate(ex.delivery_date) : 'Not readable', !!ex.delivery_date],
    ['Remarks on paper', ex.remarks || 'None', !ex.remarks],
  ] : [];

  return (
    <div>
      <Link href="/billing/review" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><Icon name="chevron" size={16} className="rotate-180" /> Review queue</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{trip.id as string}</h1>
        <StatusPill status={trip.pod_status as string} />
      </div>
      <p className="mt-1 text-sm text-ink-soft">{trip.client as string} → {trip.destination as string} · {inr(trip.freight as number)} · LR {trip.lr_no as string} · E-way bill {trip.eway_bill_no as string}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-label="POD photo">
          {latest ? (
            <a href={`/api/pod-image/${latest.id}`} target="_blank" rel="noreferrer" className="card block overflow-hidden bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/pod-image/${latest.id}`} alt={`POD photo for ${trip.id}`} className="mx-auto max-h-[70vh] w-auto" />
            </a>
          ) : <div className="card grid h-64 place-items-center text-ink-soft">No photo yet</div>}
          {latest && (
            <p className="mt-2 text-xs text-ink-faint">
              Captured {new Date(latest.captured_at).toLocaleString('en-IN')} · {latest.source === 'sms_link' ? 'SMS link' : latest.source === 'seed' ? 'sample data' : 'driver app'}
              {latest.captured_offline ? ' · taken offline' : ''}{latest.lat != null ? ` · GPS ${latest.lat.toFixed(3)}, ${latest.lng?.toFixed(3)}` : ''} · {Math.round(latest.size_bytes / 1024)} KB
            </p>
          )}
        </section>

        <div className="grid content-start gap-6 lg:col-span-2">
          <section className="card p-5" aria-labelledby="why">
            <h2 id="why" className="text-base font-semibold">Why it is here</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(latest?.reasons ?? []).map((r) => <span key={r} className="pill bg-review-bg text-review">{reasonLabel(r)}</span>)}
              {(latest?.reasons ?? []).length === 0 && <span className="text-sm text-ink-soft">No reason recorded</span>}
            </div>
            {latest?.ai_mode === 'mock' && <p className="mt-3 text-xs text-ink-faint">Reading from the demo check, not a live vision model.</p>}
          </section>

          {ex && (
            <section className="card p-5" aria-labelledby="read">
              <h2 id="read" className="text-base font-semibold">What the AI read</h2>
              <dl className="mt-3 divide-y divide-line text-sm">
                {rows.map(([k, v, good]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className={`flex items-center gap-1.5 text-right font-medium ${good ? '' : 'text-retake'}`}>{v}{!good && <Icon name="alert" size={15} />}</dd>
                  </div>
                ))}
                <div className="flex justify-between py-2.5"><dt className="text-ink-soft">Trip record says</dt><dd className="font-medium">{trip.qty as number} {trip.unit as string}</dd></div>
                <div className="flex justify-between py-2.5"><dt className="text-ink-soft">AI confidence</dt><dd className="font-medium">{Math.round(ex.confidence * 100)}%</dd></div>
              </dl>
            </section>
          )}

          <ReviewPanel tripId={trip.id as string} defaultQty={ex?.quantity ?? (trip.qty as number)} unit={trip.unit as string}
            canRetake={(trip.retake_count as number) < MAX_RETAKES} retakeCount={trip.retake_count as number} status={trip.pod_status as string} />

          <p className="text-xs text-ink-faint">Consignee {trip.consignee_name as string} · phone {trip.consignee_phone as string} (masked, personal data)</p>
        </div>
      </div>
    </div>
  );
}
