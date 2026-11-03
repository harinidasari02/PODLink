'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, ErrorNote, Icon, Spinner, fmtDate, inr } from '@/components/ui';
import type { QueueGroup } from '@/lib/queries';

type Inv = { id: number; number: string; cycle_label: string; total: number; created_at: string; share_token: string; client: string; trip_count: number };

export function QueueClient({ groups, invoices }: { groups: QueueGroup[]; invoices: Inv[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, Set<string>>>(() => Object.fromEntries(groups.map((g) => [g.key, new Set(g.trips.map((t) => t.id))])));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [made, setMade] = useState<{ id: number; number: string; total: number } | null>(null);
  const [copied, setCopied] = useState('');
  const [preview, setPreview] = useState<number | null>(null);

  const toggle = (k: string, id: string) => setPicked((p) => { const s = new Set(p[k]); s.has(id) ? s.delete(id) : s.add(id); return { ...p, [k]: s }; });
  const totalFor = (g: QueueGroup) => g.trips.filter((t) => picked[g.key]?.has(t.id)).reduce((s, t) => s + t.freight, 0);

  async function create(g: QueueGroup) {
    const ids = g.trips.filter((t) => picked[g.key]?.has(t.id)).map((t) => t.id);
    if (!ids.length) return;
    setBusy(g.key); setErr((e) => ({ ...e, [g.key]: '' }));
    try {
      const r = await fetch('/api/billing/invoices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: g.client_id, tripIds: ids }) });
      const j = await r.json();
      if (!r.ok) { setErr((e) => ({ ...e, [g.key]: j.error || 'Could not create' })); return; }
      setMade(j.invoice);
      router.refresh();
    } catch { setErr((e) => ({ ...e, [g.key]: 'No connection. Try again.' })); } finally { setBusy(''); }
  }

  const clientLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/p/${token}`;
  const sel = useMemo(() => groups, [groups]);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing queue</h1>
        <p className="mt-1 text-sm text-ink-soft">Verified PODs, grouped by client and billing cycle. Creating a batch prepares the Tally file and POD images. Nothing is sent to the client.</p>
      </div>

      {made && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-ok-bg px-5 py-4 text-ok">
          <Icon name="check" />
          <p className="flex-1 font-medium">{made.number} prepared · {inr(made.total)}</p>
          <a className="btn-ok" href={`/api/billing/invoices/${made.id}/export`}><Icon name="download" size={18} /> Download Tally file + PODs</a>
        </div>
      )}

      {sel.length === 0 ? <EmptyState icon="check" title="No verified PODs waiting" hint="Trips appear here once their POD is verified by the AI check or accepted by you." /> : sel.map((g) => (
        <section key={g.key} className="card overflow-hidden" aria-labelledby={`g-${g.key}`}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <div className="flex-1">
              <h2 id={`g-${g.key}`} className="text-base font-semibold">{g.client}</h2>
              <p className="text-sm text-ink-soft">{g.cycle} cycle · {g.cycle_label} · {g.trips.length} trips</p>
            </div>
            <p className="text-lg font-semibold tabular-nums">{inr(totalFor(g))}</p>
            <button className="btn-primary" onClick={() => create(g)} disabled={busy === g.key || !picked[g.key]?.size}>
              {busy === g.key ? <Spinner size={16} /> : <Icon name="download" size={18} />} Prepare invoice batch
            </button>
          </div>
          {err[g.key] && <div className="px-5 pt-3"><ErrorNote>{err[g.key]}</ErrorNote></div>}
          <ul className="divide-y divide-line">
            {g.trips.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <input type="checkbox" className="h-5 w-5 accent-[#1f3a5f]" checked={!!picked[g.key]?.has(t.id)} onChange={() => toggle(g.key, t.id)} aria-label={`Include ${t.id}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.id} <span className="font-normal text-ink-soft">· {t.lr_no}</span></p>
                  <p className="truncate text-xs text-ink-soft">{t.destination} · {t.branch} · delivered {fmtDate(t.delivered_on)}</p>
                </div>
                <span className={`text-xs tabular-nums ${t.waiting_days > 4 ? 'font-semibold text-retake' : 'text-ink-faint'}`}>{t.waiting_days}d waiting</span>
                <span className="w-20 text-right text-sm font-medium tabular-nums">{inr(t.freight)}</span>
                {t.submission_id && <button className="btn-quiet !px-2 !py-1" onClick={() => setPreview(t.submission_id)} aria-label={`View POD for ${t.id}`}><Icon name="eye" size={16} /></button>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {invoices.length > 0 && (
        <section aria-labelledby="recent">
          <h2 id="recent" className="mb-3 text-base font-semibold">Recent invoice batches</h2>
          <div className="card divide-y divide-line">
            {invoices.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-48"><p className="font-medium">{i.number}</p><p className="text-sm text-ink-soft">{i.client} · {i.cycle_label} · {i.trip_count} trips</p></div>
                <span className="text-sm font-semibold tabular-nums">{inr(i.total)}</span>
                <a className="btn-quiet !py-1.5" href={`/api/billing/invoices/${i.id}/export`}><Icon name="download" size={16} /> Export</a>
                <button className="btn-quiet !py-1.5" onClick={() => { navigator.clipboard?.writeText(clientLink(i.share_token)); setCopied(i.share_token); setTimeout(() => setCopied(''), 1500); }}>
                  <Icon name="link" size={16} /> {copied === i.share_token ? 'Copied' : 'Client link'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {preview != null && (
        <div role="dialog" aria-modal="true" aria-label="POD photo" className="fixed inset-0 z-20 grid place-items-center bg-ink/70 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/pod-image/${preview}`} alt="POD" className="max-h-[88vh] rounded-xl bg-paper" />
            <button className="btn-quiet absolute right-2 top-2 !px-2" onClick={() => setPreview(null)} aria-label="Close"><Icon name="x" size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
