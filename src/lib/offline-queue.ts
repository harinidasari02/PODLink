// IndexedDB queue so a photo taken in a dead zone is kept on the phone and sent when signal returns.
export interface QueueItem {
  ref: string; tripId: string; token: string | null; blob: Blob; capturedAt: string;
  lat: number | null; lng: number | null; accuracy: number | null; offline: boolean; createdAt: number;
  result?: SendResult;
}
export interface PodResult {
  ok: true; decision: 'verified' | 'retake' | 'needs_review'; reasons: string[]; reasonText: string[];
  retakesLeft: number; aiMode: 'vision' | 'mock' | 'none';
}
export type SendResult = { status: 'ok'; data: PodResult } | { status: 'rejected'; message: string };

const DB = 'podlink', STORE = 'queue';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'ref' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export const enqueue = (item: QueueItem) => tx('readwrite', (s) => s.put(item));
export const getItem = (ref: string) => tx<QueueItem | undefined>('readonly', (s) => s.get(ref));
export const allItems = () => tx<QueueItem[]>('readonly', (s) => s.getAll());
export const removeItem = (ref: string) => tx('readwrite', (s) => s.delete(ref));

/** Items still waiting to be delivered (no server answer yet). */
export async function pendingCount(): Promise<number> {
  try { return (await allItems()).filter((i) => !i.result).length; } catch { return 0; }
}

let flushing = false;

/** Try to upload one item. Network failure leaves it queued; a server answer (even a refusal) ends retries. */
export async function sendOne(ref: string): Promise<SendResult | null> {
  const item = await getItem(ref);
  if (!item) return null;
  if (item.result) return item.result;
  const fd = new FormData();
  fd.set('tripId', item.tripId);
  fd.set('capturedAt', item.capturedAt);
  fd.set('offline', item.offline ? '1' : '0');
  fd.set('clientRef', item.ref);
  if (item.token) fd.set('token', item.token);
  if (item.lat != null && item.lng != null) { fd.set('lat', String(item.lat)); fd.set('lng', String(item.lng)); }
  if (item.accuracy != null) fd.set('accuracy', String(item.accuracy));
  fd.set('image', item.blob, 'pod.jpg');
  let res: Response;
  try { res = await fetch('/api/pod/upload', { method: 'POST', body: fd }); } catch { return null; }
  if (res.status === 429 || res.status >= 500) return null; // temporary: keep and retry later
  const body = await res.json().catch(() => ({}));
  const result: SendResult = res.ok ? { status: 'ok', data: body as PodResult } : { status: 'rejected', message: body.error || 'Not accepted' };
  await enqueue({ ...item, result });
  return result;
}

export async function flushQueue(): Promise<void> {
  if (flushing || typeof indexedDB === 'undefined') return;
  flushing = true;
  try {
    for (const i of await allItems()) if (!i.result) await sendOne(i.ref);
  } finally { flushing = false; }
}
