'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorNote, Icon, Spinner } from '@/components/ui';

export function ReviewPanel({ tripId, defaultQty, unit, canRetake, retakeCount, status }: { tripId: string; defaultQty: number; unit: string; canRetake: boolean; retakeCount: number; status: string }) {
  const router = useRouter();
  const [qty, setQty] = useState(String(defaultQty));
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState<'' | 'approve' | 'retake'>('');
  const [err, setErr] = useState('');

  if (status !== 'needs_review') return <div className="card p-5 text-sm text-ink-soft">This POD is no longer waiting for review.</div>;

  async function act(action: 'approve' | 'retake') {
    setErr(''); setBusy(action);
    const n = Number(qty);
    if (action === 'approve' && (!Number.isInteger(n) || n < 0)) { setErr('Quantity must be a whole number.'); setBusy(''); return; }
    try {
      const r = await fetch(`/api/billing/review/${tripId}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, corrections: action === 'approve' ? { quantity: n, remarks: remarks || undefined } : { note: remarks || undefined } }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not save'); return; }
      router.push('/billing/review');
      router.refresh();
    } catch { setErr('No connection. Try again.'); } finally { setBusy(''); }
  }

  return (
    <section className="card p-5" aria-labelledby="decide">
      <h2 id="decide" className="text-base font-semibold">Your decision</h2>
      <p className="mt-1 text-xs text-ink-soft">Correct anything the AI misread. Your correction is saved beside the AI reading, never over it.</p>
      <label className="label mt-4" htmlFor="qty">Quantity received ({unit})</label>
      <input id="qty" inputMode="numeric" className="field" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
      <label className="label mt-3" htmlFor="rem">Note for the record</label>
      <input id="rem" className="field" maxLength={300} placeholder="e.g. 6 cartons short, client informed" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button className="btn-ok" onClick={() => act('approve')} disabled={!!busy}>{busy === 'approve' ? <Spinner size={16} /> : <Icon name="check" size={18} />} Accept for billing</button>
        <button className="btn-quiet" onClick={() => act('retake')} disabled={!!busy || !canRetake} title={canRetake ? '' : 'Retake limit reached'}>{busy === 'retake' ? <Spinner size={16} /> : <Icon name="retake" size={18} />} Ask for retake</button>
      </div>
      {!canRetake && <p className="mt-2 text-xs text-ink-soft">Retake limit reached ({retakeCount} of 2). Accept the photo, or call the driver.</p>}
      <p className="mt-3 text-xs text-ink-faint">Accepting only moves the trip to the billing queue. Nothing is invoiced or sent automatically.</p>
    </section>
  );
}
