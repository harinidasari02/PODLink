import { db } from '@/lib/db';
import { CaptureFlow } from '@/components/CaptureFlow';
import { Logo } from '@/components/ui';
import { MAX_RETAKES } from '@/lib/pod-rules';
import { unitFor } from '@/lib/seed-data';

export const metadata = { title: 'Upload POD' };
export const dynamic = 'force-dynamic';

/** Hired drivers open this link from an SMS. No app, no login: the token is scoped to one trip and expires. */
export default async function SmsUpload({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = /^[a-f0-9]{32,64}$/.test(token)
    ? (db().prepare(`SELECT t.id, t.lr_no, t.destination, t.qty, t.client_id, t.pod_status, t.retake_count, c.name AS client, l.expires_at
        FROM sms_links l JOIN trips t ON t.id = l.trip_id JOIN clients c ON c.id = t.client_id WHERE l.token = ?`).get(token) as
        { id: string; lr_no: string; destination: string; qty: number; client_id: number; pod_status: string; retake_count: number; client: string; expires_at: string } | undefined)
    : undefined;

  if (!row || row.expires_at < new Date().toISOString()) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-6 text-center">
        <div><Logo /><h1 className="mt-6 text-xl font-semibold">This link has expired</h1><p className="mt-2 text-sm text-ink-soft">Ask the Company A office to send a new link.</p></div>
      </main>
    );
  }
  if (row.pod_status === 'verified' || row.pod_status === 'billed') {
    return (
      <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-6 text-center">
        <div><Logo /><h1 className="mt-6 text-xl font-semibold">POD already received ✓</h1><p className="mt-2 text-sm text-ink-soft">Nothing more to do. Thank you.</p></div>
      </main>
    );
  }
  return (
    <CaptureFlow token={token} defaultLang="hi"
      trip={{ id: row.id, lr_no: row.lr_no, destination: row.destination, client: row.client, qty: row.qty, unit: unitFor(row.client_id), retakes_left: Math.max(0, MAX_RETAKES - row.retake_count), retake_reasons: [] }} />
  );
}
