import { dashboard } from '@/lib/queries';
import { EmptyState, StatusPill } from '@/components/ui';
import { SmsLinkButton } from './SmsLinkButton';

export const metadata = { title: 'Dashboard' };

const BASELINE = 18, TARGET = 4;

export default function Dashboard() {
  const d = dashboard();
  const maxAge = Math.max(1, ...d.aging.map((a) => a.n));
  const kpis = [
    { label: 'Trips without POD', value: d.kpi.missing, tone: d.kpi.missing ? 'text-retake' : 'text-ok' },
    { label: 'Waiting for review', value: d.kpi.review, tone: 'text-review' },
    { label: 'Ready to bill', value: d.kpi.ready, tone: 'text-ok' },
    { label: 'POD to invoice', value: d.kpi.avg_days == null ? '–' : `${d.kpi.avg_days} days`, tone: 'text-ink', sub: `Was ${BASELINE} days · target ${TARGET}` },
  ];
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">{d.kpi.coverage}% of delivered trips have a POD in the system.</p>
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{k.label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${k.tone}`}>{k.value}</p>
            {k.sub && <p className="mt-1 text-xs text-ink-faint">{k.sub}</p>}
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card overflow-hidden lg:col-span-3" aria-labelledby="by-branch">
          <h2 id="by-branch" className="px-5 pt-5 text-base font-semibold">By branch</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-faint">
                <tr><th className="px-5 py-2 font-medium">Branch</th><th className="px-3 py-2 text-right font-medium">No POD</th><th className="px-3 py-2 text-right font-medium">Review</th><th className="px-3 py-2 text-right font-medium">Ready</th><th className="px-5 py-2 text-right font-medium">POD→invoice</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.byBranch.map((b) => (
                  <tr key={b.branch}>
                    <td className="px-5 py-3 font-medium">{b.branch}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${b.missing ? 'font-semibold text-retake' : 'text-ink-faint'}`}>{b.missing}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{b.review}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{b.ready}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{b.avg_days == null ? '–' : `${b.avg_days} d`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5 lg:col-span-2" aria-labelledby="aging">
          <h2 id="aging" className="text-base font-semibold">How long PODs are missing</h2>
          <ul className="mt-4 grid gap-3.5">
            {d.aging.map((a, i) => (
              <li key={a.label}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-ink-soft">{a.label}</span><span className="font-semibold tabular-nums">{a.n}</span></div>
                <div className="h-2 rounded-full bg-wash"><div className={`h-2 rounded-full ${i >= 2 ? 'bg-retake' : 'bg-brand'}`} style={{ width: `${(a.n / maxAge) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="missing">
        <h2 id="missing" className="mb-3 text-base font-semibold">Trips without POD</h2>
        {d.missing.length === 0 ? <EmptyState title="Every delivered trip has a POD" hint="New gaps will appear here." /> : (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {[...d.missing].sort((a, b) => b.days - a.days).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-medium">{m.id} <span className="font-normal text-ink-soft">· {m.lr_no}</span></p>
                    <p className="truncate text-sm text-ink-soft">{m.client} → {m.destination} · {m.vehicle_no}{m.hired ? ' (hired)' : ''} · {m.branch}</p>
                  </div>
                  <StatusPill status={m.status} />
                  <span className={`w-16 text-right text-sm font-semibold tabular-nums ${m.days > 10 ? 'text-retake' : 'text-ink-soft'}`}>{m.days}d</span>
                  <SmsLinkButton tripId={m.id} hired={m.hired} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
