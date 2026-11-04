import { db } from '@/lib/db';
import { Logo, fmtDate } from '@/components/ui';

export const metadata = { title: 'Proofs of delivery', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Read-only client link. Shows PODs for one invoice batch only. Consignee phone numbers are never shown here (DPDP data minimisation). */
export default async function ClientView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = /^[a-z0-9]{8,64}$/i.test(token)
    ? (db().prepare('SELECT i.id, i.number, i.cycle_label, c.name AS client FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.share_token = ?').get(token) as { id: number; number: string; cycle_label: string; client: string } | undefined)
    : undefined;
  if (!inv) {
    return <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-6 text-center"><div><Logo /><h1 className="mt-6 text-xl font-semibold">Link not found</h1><p className="mt-2 text-sm text-ink-soft">Please ask Company A for a new link.</p></div></main>;
  }
  const trips = db().prepare(`SELECT t.id, t.lr_no, t.destination, t.delivered_on, t.qty, (SELECT id FROM pod_submissions WHERE trip_id = t.id ORDER BY id DESC LIMIT 1) AS sub
      FROM trips t WHERE t.invoice_id = ? ORDER BY t.delivered_on`).all(inv.id) as { id: string; lr_no: string; destination: string; delivered_on: string; qty: number; sub: number | null }[];
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Logo />
      <h1 className="mt-6 text-2xl font-semibold">Proofs of delivery · {inv.number}</h1>
      <p className="mt-1 text-sm text-ink-soft">{inv.client} · {inv.cycle_label} · {trips.length} {trips.length === 1 ? "trip" : "trips"}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {trips.map((t) => (
          <li key={t.id} className="card overflow-hidden">
            {t.sub ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/pod-image/${t.sub}?share=${token}`} alt={`POD for LR ${t.lr_no}`} className="aspect-[3/4] w-full bg-wash object-cover object-top" loading="lazy" />
            ) : <div className="grid aspect-[3/4] place-items-center bg-wash text-sm text-ink-soft">No image</div>}
            <div className="p-4 text-sm"><p className="font-semibold">LR {t.lr_no}</p><p className="text-ink-soft">{t.destination} · delivered {fmtDate(t.delivered_on)}</p></div>
          </li>
        ))}
      </ul>
    </main>
  );
}
