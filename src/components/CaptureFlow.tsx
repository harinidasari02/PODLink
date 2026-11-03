'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, Spinner, type IconName } from './ui';
import { LangSwitch } from './LangSwitch';
import { compressWithStamp } from '@/lib/compress';
import { enqueue, flushQueue, getItem, sendOne, type PodResult, type SendResult } from '@/lib/offline-queue';
import { speak, T } from '@/lib/i18n';
import { useLang } from '@/lib/use-lang';
import type { Lang } from '@/lib/types';

export interface CaptureTrip { id: string; lr_no: string; destination: string; client: string; qty: number; unit: string; retakes_left: number; retake_reasons: string[] }
type Phase = { k: 'idle' } | { k: 'working'; step: 'gps' | 'prep' | 'send' } | { k: 'queued'; ref: string } | { k: 'result'; res: PodResult } | { k: 'rejected'; msg: string };

const REASON_ICON: Record<string, IconName> = {
  quality_blurry: 'blur', quality_dark: 'sun', quality_cropped: 'frame', stamp_missing: 'stamp',
  signature_missing: 'pen', lr_missing: 'doc', lr_mismatch: 'doc', date_missing: 'clock',
};
const reasonKey = (r: string) => (`r_${r}` as keyof typeof T.en);

function getPosition(): Promise<{ lat: number; lng: number; acc: number } | null> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => res(null), { timeout: 7000, maximumAge: 120_000, enableHighAccuracy: false });
  });
}

export function CaptureFlow({ trip, token, defaultLang, backHref }: { trip: CaptureTrip; token?: string; defaultLang: Lang; backHref?: string }) {
  const [lang, setLang] = useLang(defaultLang);
  const t = T[lang];
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });
  const [retakesLeft, setRetakesLeft] = useState(trip.retakes_left);
  const [reasons, setReasons] = useState(trip.retake_reasons);
  const input = useRef<HTMLInputElement>(null);
  const gpsPromise = useRef<ReturnType<typeof getPosition> | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => { setOnline(true); void flushQueue(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const showResult = useCallback((r: SendResult) => {
    if (r.status === 'ok') { setRetakesLeft(r.data.retakesLeft); setReasons(r.data.decision === 'retake' ? r.data.reasons : []); setPhase({ k: 'result', res: r.data }); }
    else setPhase({ k: 'rejected', msg: r.message });
  }, []);

  // Voice prompt for each screen
  useEffect(() => {
    if (phase.k === 'idle') {
      const why = reasons.map((x) => t[reasonKey(x)] ?? '').join(' ');
      speak(why ? `${t.retake_title}. ${why}` : t.tap_photo, lang);
    }
    if (phase.k === 'queued') speak(t.saved_offline, lang);
    if (phase.k === 'result') {
      const r = phase.res;
      if (r.decision === 'verified') speak(t.accepted, lang);
      else if (r.decision === 'retake') speak(`${t.retake_title}. ${r.reasons.map((x) => t[reasonKey(x)] ?? '').join(' ')}`, lang);
      else speak(t.review_title, lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.k, lang]);

  // While a photo is waiting for signal, keep trying and pick up the answer when it arrives.
  useEffect(() => {
    if (phase.k !== 'queued') return;
    const ref = phase.ref;
    const id = setInterval(async () => {
      if (navigator.onLine) await sendOne(ref);
      const item = await getItem(ref);
      if (item?.result) showResult(item.result);
    }, 4000);
    return () => clearInterval(id);
  }, [phase, showResult]);

  function start() {
    gpsPromise.current = getPosition(); // ask for location the moment the driver taps
    input.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhase({ k: 'working', step: 'gps' });
      const pos = await (gpsPromise.current ?? getPosition());
      setPhase({ k: 'working', step: 'prep' });
      const when = new Date();
      const stamp = `${trip.id} · ${when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · ${pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)} ±${Math.round(pos.acc)}m` : 'GPS n/a'}`;
      const blob = await compressWithStamp(file, stamp);
      const ref = crypto.randomUUID();
      await enqueue({
        ref, tripId: trip.id, token: token ?? null, blob, capturedAt: when.toISOString(),
        lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos?.acc ?? null, offline: !navigator.onLine, createdAt: Date.now(),
      });
      setPhase({ k: 'working', step: 'send' });
      const r = navigator.onLine ? await sendOne(ref) : null;
      if (r) showResult(r); else setPhase({ k: 'queued', ref });
    } catch {
      setPhase({ k: 'rejected', msg: 'Could not prepare the photo. Please try again.' });
    }
  }

  const stepLabel = phase.k === 'working' ? { gps: t.gps_wait, prep: t.preparing, send: t.sending }[phase.step] : '';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-4">
      <header className="flex items-center justify-between">
        {backHref ? <Link href={backHref} className="btn-quiet !px-3" aria-label={t.back}><Icon name="chevron" className="rotate-180" /></Link> : <span />}
        <div className="flex items-center gap-2">
          {!online && <span className="pill bg-retake-bg text-retake"><Icon name="wifioff" size={14} /> Offline</span>}
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
      </header>

      <section className="mt-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{trip.client}</p>
        <h1 className="mt-1 text-3xl font-semibold">{trip.destination}</h1>
        <p className="mt-1 text-sm text-ink-soft">{trip.lr_no} · {trip.qty} {trip.unit}</p>
      </section>

      <main className="flex flex-1 flex-col items-center justify-center py-8">
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take photo" />

        {phase.k === 'idle' && (
          <>
            {reasons.length > 0 && (
              <ul className="mb-6 grid w-full gap-2">
                {reasons.map((r) => (
                  <li key={r} className="flex items-center gap-3 rounded-xl bg-retake-bg px-4 py-3 text-sm font-medium text-retake"><Icon name={REASON_ICON[r] ?? 'alert'} size={24} />{t[reasonKey(r)]}</li>
                ))}
              </ul>
            )}
            <button onClick={start} className="grid h-56 w-56 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/25 transition active:scale-95" aria-label={t.tap_photo}>
              <Icon name="camera" size={88} strokeWidth={1.4} />
            </button>
            <p className="mt-7 max-w-xs text-center text-base text-ink-soft">{t.hold_steady}</p>
            <button onClick={() => speak(t.tap_photo, lang)} className="btn-quiet mt-4 !rounded-full" aria-label="Play voice prompt"><Icon name="speaker" /></button>
          </>
        )}

        {phase.k === 'working' && (
          <div className="grid place-items-center gap-4 text-brand" role="status" aria-live="polite">
            <Spinner size={56} />
            <p className="text-lg font-medium text-ink">{stepLabel}</p>
          </div>
        )}

        {phase.k === 'queued' && (
          <div className="grid place-items-center gap-5 text-center" role="status">
            <span className="grid h-40 w-40 place-items-center rounded-full bg-retake-bg text-retake"><Icon name="wifioff" size={72} strokeWidth={1.4} /></span>
            <p className="max-w-xs text-lg font-medium">{t.saved_offline}</p>
            <button className="btn-quiet" onClick={async () => { await flushQueue(); const it = await getItem(phase.ref); if (it?.result) showResult(it.result); }}><Icon name="upload" /> {t.sync_now}</button>
          </div>
        )}

        {phase.k === 'result' && <ResultView res={phase.res} t={t} retakesLeft={retakesLeft} onRetake={() => setPhase({ k: 'idle' })} backHref={backHref} lang={lang} />}

        {phase.k === 'rejected' && (
          <div className="grid place-items-center gap-5 text-center" role="alert">
            <span className="grid h-40 w-40 place-items-center rounded-full bg-bad-bg text-bad"><Icon name="alert" size={72} strokeWidth={1.4} /></span>
            <p className="max-w-xs text-lg font-medium">{t.rejected}</p>
            <p className="max-w-xs text-sm text-ink-soft">{phase.msg}</p>
            <button className="btn-primary" onClick={() => setPhase({ k: 'idle' })}><Icon name="camera" /> {t.take_again}</button>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultView({ res, t, retakesLeft, onRetake, backHref, lang }: { res: PodResult; t: (typeof T)['en']; retakesLeft: number; onRetake: () => void; backHref?: string; lang: Lang }) {
  const ok = res.decision === 'verified', retake = res.decision === 'retake';
  const tone = ok ? 'bg-ok-bg text-ok' : retake ? 'bg-retake-bg text-retake' : 'bg-review-bg text-review';
  return (
    <div className="grid w-full place-items-center gap-5 text-center" role="status" aria-live="polite">
      <span className={`grid h-44 w-44 place-items-center rounded-full ${tone}`}>
        <Icon name={ok ? 'check' : retake ? 'retake' : 'upload'} size={84} strokeWidth={ok ? 2 : 1.5} />
      </span>
      <div>
        <h2 className="text-2xl font-semibold">{ok ? t.accepted : retake ? t.retake_title : t.review_title}</h2>
        <p className="mt-1.5 text-ink-soft">{ok ? t.accepted_body : retake ? '' : t.review_body}</p>
      </div>

      {retake && (
        <>
          <ul className="grid w-full gap-2">
            {res.reasons.map((r) => (
              <li key={r} className="flex items-center gap-3 rounded-xl border border-retake/20 bg-retake-bg px-4 py-3 text-left font-medium text-retake">
                <Icon name={REASON_ICON[r] ?? 'alert'} size={28} />{t[reasonKey(r)] ?? res.reasonText[0]}
              </li>
            ))}
          </ul>
          <button className="btn-retake w-full py-4 text-lg" onClick={onRetake}><Icon name="camera" size={24} /> {t.take_again}</button>
          <p className="text-sm text-ink-soft">{t.retakes_left}: {retakesLeft}</p>
        </>
      )}
      {!retake && (backHref
        ? <Link href={backHref} className={ok ? 'btn-ok w-full py-4 text-lg' : 'btn-quiet w-full py-4 text-lg'}>{t.back}</Link>
        : <p className="text-sm text-ink-soft">{t.done_close}</p>)}
      {res.aiMode === 'mock' && <p className="text-xs text-ink-faint">Demo check · {lang === 'en' ? 'simulated AI reading' : 'Demo'}</p>}
    </div>
  );
}
