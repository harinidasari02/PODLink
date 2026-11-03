'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorNote, Icon, Spinner } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'driver' | 'billing'>('driver');
  const [login, setLogin] = useState('');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, login, secret }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not sign in'); return; }
      router.replace(j.redirect);
      router.refresh();
    } catch { setErr('No connection. Try again.'); } finally { setBusy(false); }
  }

  const pin = (d: string) => setSecret((s) => (d === '⌫' ? s.slice(0, -1) : (s + d).slice(0, 4)));

  return (
    <form onSubmit={submit} className="mt-7">
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-xl border border-line bg-paper p-1 text-sm font-semibold">
        {(['driver', 'billing'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setSecret(''); setErr(''); }}
            className={`rounded-lg py-2 ${mode === m ? 'bg-brand text-white' : 'text-ink-soft'}`}>{m === 'driver' ? 'Driver' : 'Office'}</button>
        ))}
      </div>

      {mode === 'driver' ? (
        <>
          <label className="label" htmlFor="code">Driver code</label>
          <input id="code" className="field text-lg tracking-widest" autoCapitalize="characters" autoComplete="username" placeholder="D101" value={login} onChange={(e) => setLogin(e.target.value.toUpperCase())} maxLength={8} required />
          <p className="label mt-5">PIN</p>
          <div className="mb-4 flex justify-center gap-3" aria-label={`${secret.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-full border ${i < secret.length ? 'border-brand bg-brand' : 'border-ink-faint'}`} />)}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => d === '' ? <span key={i} /> : (
              <button key={i} type="button" onClick={() => pin(d)} aria-label={d === '⌫' ? 'Delete' : d} className="h-14 rounded-xl border border-line bg-paper text-xl font-semibold active:bg-wash">{d}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="field" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
          <label className="label mt-4" htmlFor="pw">Password</label>
          <input id="pw" type="password" className="field" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} required />
        </>
      )}

      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
      <button className="btn-primary mt-6 w-full py-3.5 text-base" disabled={busy || (mode === 'driver' && secret.length < 4)}>
        {busy ? <Spinner /> : <Icon name="chevron" />} Continue
      </button>
    </form>
  );
}
