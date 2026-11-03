'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon, Logo, StatusPill } from '@/components/ui';
import { LangSwitch } from '@/components/LangSwitch';
import { useLang } from '@/lib/use-lang';
import { T, speak } from '@/lib/i18n';
import { flushQueue, pendingCount } from '@/lib/offline-queue';
import type { DriverTrip } from '@/lib/queries';
import type { Lang } from '@/lib/types';

const KEY = 'podlink_trips';

export function DriverHome({ name, defaultLang, trips: initial }: { name: string; defaultLang: Lang; trips: DriverTrip[] }) {
  const router = useRouter();
  const [lang, setLang] = useLang(defaultLang);
  const t = T[lang];
  const [trips, setTrips] = useState(initial);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    // remember the list for dead zones, and warm the offline cache of each capture screen
    try { localStorage.setItem(KEY, JSON.stringify(initial)); } catch { /* ignore */ }
    initial.forEach((tr) => { fetch(`/driver/trip/${tr.id}`).catch(() => {}); });
    const refresh = async () => { await flushQueue(); setWaiting(await pendingCount()); };
    void refresh();
    const id = setInterval(refresh, 8000);
    window.addEventListener('online', refresh);
    return () => { clearInterval(id); window.removeEventListener('online', refresh); };
  }, [initial]);

  useEffect(() => {
    if (!navigator.onLine) { try { const c = localStorage.getItem(KEY); if (c) setTrips(JSON.parse(c)); } catch { /* ignore */ } }
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 pb-10 pt-4">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <LangSwitch lang={lang} onChange={setLang} />
          <button onClick={logout} className="btn-quiet !px-3" aria-label="Sign out"><Icon name="logout" /></button>
        </div>
      </header>

      <div className="mt-7 flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-soft">{t.hello}</p>
          <h1 className="text-2xl font-semibold">{name}</h1>
        </div>
        <button onClick={() => speak(t.trips, lang)} className="btn-quiet !rounded-full !px-3" aria-label="Play voice prompt"><Icon name="speaker" /></button>
      </div>

      {waiting > 0 && (
        <button onClick={() => flushQueue().then(() => pendingCount().then(setWaiting))} className="mt-5 flex w-full items-center gap-3 rounded-xl bg-retake-bg px-4 py-3 text-left text-sm font-medium text-retake">
          <Icon name="wifioff" /> <span className="flex-1">{waiting} {t.waiting_send}</span> <Icon name="upload" />
        </button>
      )}

      <h2 className="mb-3 mt-8 text-xs font-medium uppercase tracking-wide text-ink-faint">{t.trips}</h2>
      {trips.length === 0 ? (
        <div className="card grid place-items-center px-6 py-14 text-center text-ink-soft"><Icon name="truck" size={36} /><p className="mt-3">{t.no_trips}</p></div>
      ) : (
        <ul className="grid gap-3">
          {trips.map((tr) => {
            const onRoad = tr.delivered_on === null && tr.pod_status === 'none';
            return (
              <li key={tr.id}>
                <Link href={`/driver/trip/${tr.id}`} className="card flex items-center gap-4 p-4 transition active:bg-wash">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tr.pod_status === 'retake_requested' ? 'bg-retake-bg text-retake' : tr.pod_status === 'verified' ? 'bg-ok-bg text-ok' : 'bg-wash text-brand'}`}>
                    <Icon name={tr.pod_status === 'verified' ? 'check' : tr.pod_status === 'retake_requested' ? 'retake' : 'truck'} size={28} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold">{tr.destination}</span>
                    <span className="block truncate text-sm text-ink-soft">{tr.lr_no} · {tr.qty} {tr.unit}</span>
                    <span className="mt-1.5 inline-block">{onRoad ? <span className="pill bg-wash text-ink-soft"><Icon name="truck" size={13} />{t.on_the_road}</span> : <StatusPill status={tr.pod_status} />}</span>
                  </span>
                  <Icon name="chevron" className="text-ink-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
