'use client';
import { useState } from 'react';
import { Icon, Spinner } from '@/components/ui';

/** Creates a one-trip upload link for a hired driver. Real SMS delivery is mocked: the executive copies the link. */
export function SmsLinkButton({ tripId, hired }: { tripId: string; hired: boolean }) {
  const [state, setState] = useState<{ k: 'idle' } | { k: 'busy' } | { k: 'done'; url: string } | { k: 'err'; msg: string }>({ k: 'idle' });
  const [copied, setCopied] = useState(false);

  async function create() {
    setState({ k: 'busy' });
    try {
      const r = await fetch('/api/billing/sms-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tripId }) });
      const j = await r.json();
      setState(r.ok ? { k: 'done', url: j.url } : { k: 'err', msg: j.error || 'Could not create link' });
    } catch { setState({ k: 'err', msg: 'No connection' }); }
  }

  if (state.k === 'done') {
    return (
      <div className="flex w-full items-center gap-2 rounded-xl bg-wash px-3 py-2 text-xs sm:w-auto">
        <span className="pill bg-review-bg text-review">SMS (mock)</span>
        <a href={state.url} className="max-w-48 truncate text-brand underline" target="_blank" rel="noreferrer">{state.url}</a>
        <button className="btn-quiet !px-2 !py-1" onClick={() => { navigator.clipboard?.writeText(state.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {state.k === 'err' && <span className="text-xs text-bad">{state.msg}</span>}
      <button className="btn-quiet !py-1.5" onClick={create} disabled={state.k === 'busy'} title={hired ? 'Hired truck: send an upload link by SMS' : 'Send an upload link by SMS'}>
        {state.k === 'busy' ? <Spinner size={14} /> : <Icon name="sms" size={16} />} {hired ? 'Send SMS link' : 'SMS link'}
      </button>
    </div>
  );
}
