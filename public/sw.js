/* offline cache */

const CACHE = 'tao-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');
  if (url.origin !== location.origin && !font) return;

  /* the page itself: network first, so a new deploy shows up, cache when offline */
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { put(req, r.clone()); return r; }).catch(() => caches.match(req).then(r => r || caches.match('/'))));
    return;
  }

  /* everything else: cache first, refresh in the background */
  e.respondWith(caches.match(req).then(hit => {
    const fresh = fetch(req).then(r => { if (r.ok || r.type === 'opaque') put(req, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  }));
});

function put(req, res) {
  return caches.open(CACHE).then(c => c.put(req, res)).catch(() => {});
}
