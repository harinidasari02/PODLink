import Link from 'next/link';
import { reviewQueue, reasonLabel } from '@/lib/queries';
import { EmptyState, Icon, inr, fmtDate } from '@/components/ui';

export const metadata = { title: 'Review' };

export default function ReviewQueue() {
  const items = reviewQueue();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Review queue</h1>
      <p className="mt-1 text-sm text-ink-soft">PODs with a shortage or damage remark, a mismatch, or a low-confidence reading. The photo is the source of truth.</p>
      <div className="mt-6">
        {items.length === 0 ? <EmptyState title="Nothing to review" hint="PODs that need a person will appear here." /> : (
          <ul className="grid gap-3">
            {items.map((i) => (
              <li key={i.trip_id}>
                <Link href={`/billing/review/${i.trip_id}`} className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4 transition hover:border-ink-faint sm:p-5">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-semibold">{i.trip_id} <span className="font-normal text-ink-soft">· {i.lr_no}</span></p>
                    <p className="mt-0.5 text-sm text-ink-soft">{i.client} → {i.destination} · {i.branch}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {i.reasons.map((r) => <span key={r} className="pill bg-review-bg text-review">{reasonLabel(r)}</span>)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-ink-soft">
                    <p className="font-semibold text-ink tabular-nums">{inr(i.freight)}</p>
                    <p>{fmtDate(i.received_at)}{i.confidence != null && ` · ${Math.round(i.confidence * 100)}% sure`}</p>
                  </div>
                  <Icon name="chevron" className="text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
