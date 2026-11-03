import type { ReactNode, SVGProps } from 'react';

const P: Record<string, ReactNode> = {
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  retake: <><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v4.5h4.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  upload: <><path d="M12 16V5" /><path d="m7.5 9.5 4.5-4.5 4.5 4.5" /><path d="M5 19h14" /></>,
  truck: <><path d="M2.5 6.5h11v9h-11z" /><path d="M13.5 9.5h4l3 3.2v2.8h-7" /><circle cx="7" cy="16.5" r="1.8" /><circle cx="17" cy="16.5" r="1.8" /></>,
  speaker: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  stamp: <><path d="M9 14h6l-1-5.5a2 2 0 1 0-4 0L9 14Z" /><path d="M6 14h12v3H6z" /><path d="M5 20h14" /></>,
  pen: <><path d="m4 20 1.2-4.2L16 5l3 3L8.2 18.8 4 20Z" /><path d="m14 7 3 3" /></>,
  doc: <><path d="M7 3.5h7l4 4V20.5H7z" /><path d="M14 3.5v4h4" /><path d="M9.5 12h6M9.5 15.5h6" /></>,
  sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
  frame: <><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  blur: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="6.5" strokeDasharray="2 3" /><circle cx="12" cy="12" r="9.5" strokeDasharray="1 4" /></>,
  wifioff: <><path d="M3 3l18 18" /><path d="M8.5 16.2a5 5 0 0 1 7 0" /><path d="M5 12.8a9.5 9.5 0 0 1 3-1.9M19 12.8a9.6 9.6 0 0 0-5.5-2.7" /><circle cx="12" cy="19" r="0.8" /></>,
  logout: <><path d="M10 4H5.5v16H10" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
  alert: <><path d="M12 4 3 19.5h18L12 4Z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  chevron: <path d="m9 5.5 6.5 6.5L9 18.5" />,
  sms: <><path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z" /><path d="M8 10h8M8 13h5" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>{P[name]}</svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-brand">
      <span className="grid place-items-center rounded-lg bg-brand text-white" style={{ width: size + 8, height: size + 8 }}>
        <Icon name="check" size={size - 4} strokeWidth={2.4} />
      </span>
      PODLink
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string; icon: IconName }> = {
  none: { label: 'No POD', cls: 'bg-wash text-ink-soft', icon: 'clock' },
  retake_requested: { label: 'Retake asked', cls: 'bg-retake-bg text-retake', icon: 'retake' },
  needs_review: { label: 'Needs review', cls: 'bg-review-bg text-review', icon: 'eye' },
  verified: { label: 'Verified', cls: 'bg-ok-bg text-ok', icon: 'check' },
  billed: { label: 'Invoiced', cls: 'bg-wash text-ink-soft', icon: 'check' },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.none;
  return <span className={`pill ${s.cls}`}><Icon name={s.icon} size={13} />{s.label}</span>;
}

export function EmptyState({ icon = 'check', title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-wash text-ink-soft"><Icon name={icon} size={22} /></span>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="flex items-start gap-2 rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm text-bad"><Icon name="alert" size={18} className="mt-0.5 shrink-0" />{children}</p>;
}

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
export const fmtDate = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '–');
