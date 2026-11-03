// Minimal offline shell: pages and static assets the driver has already opened keep working without signal.
// API calls are never cached (uploads go through the IndexedDB queue instead).
const CACHE = 'podlink-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const cacheable = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/driver') || url.pathname.startsWith('/u/') || url.pathname === '/manifest.webmanifest';
  if (!cacheable) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((m) => m || new Response('Offline', { status: 503 })))
  );
});
