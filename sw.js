/* Bump CACHE whenever index.html, the manifest, or an icon changes.
   Files under ./data/ are network-first and need no bump. */
const CACHE = 'training-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u =>
        c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* data files: always try the network so a new push lands next launch,
     fall back to the cached copy when offline */
  if (url.pathname.includes('/data/')) {
    const key = url.origin + url.pathname;
    e.respondWith(
      fetch(new Request(req.url, { cache: 'no-store' }))
        .then(r => {
          if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(key, c)); }
          return r;
        })
        .catch(() => caches.match(key).then(r => r || new Response('', { status: 504 })))
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put('./index.html', c)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.status === 200 && r.type === 'basic') {
        const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c));
      }
      return r;
    }))
  );
});
