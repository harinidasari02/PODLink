'use client';
import { useRef, useState } from 'react';
import { ErrorNote, Icon, Spinner } from '@/components/ui';

interface Report { inserted: number; updated: number; skipped: number; errors: { line: number; message: string }[] }

export function ImportClient() {
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState('');

  async function upload() {
    const f = file.current?.files?.[0];
    if (!f) { setErr('Choose a CSV file first.'); return; }
    setErr(''); setReport(null); setBusy(true);
    try {
      const r = await fetch('/api/billing/import', { method: 'POST', headers: { 'content-type': 'text/csv' }, body: await f.text() });
      const j = await r.json();
      if (!r.ok) setErr(j.error || 'Import failed'); else setReport(j);
    } catch { setErr('No connection. Try again.'); } finally { setBusy(false); }
  }

  return (
    <div className="mt-6 grid max-w-2xl gap-5">
      <div className="card p-5">
        <label className="label" htmlFor="csv">Trip file (CSV)</label>
        <input id="csv" ref={file} type="file" accept=".csv,text/csv" className="field file:mr-3 file:rounded-lg file:border-0 file:bg-wash file:px-3 file:py-1.5 file:text-sm file:font-medium" onChange={(e) => setName(e.target.files?.[0]?.name ?? '')} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={upload} disabled={busy || !name}>{busy ? <Spinner size={16} /> : <Icon name="upload" size={18} />} Import trips</button>
          <a href="/sample-trips.csv" download className="text-sm text-brand underline">Download a sample file</a>
        </div>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      {report && (
        <div className="card p-5" role="status">
          <p className="font-semibold">{report.inserted} added · {report.updated} updated · {report.skipped} skipped</p>
          {report.errors.length > 0 && (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {report.errors.slice(0, 20).map((e, i) => <li key={i} className="text-bad">Line {e.line}: {e.message}</li>)}
              {report.errors.length > 20 && <li className="text-ink-soft">…and {report.errors.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
