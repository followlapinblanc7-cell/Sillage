/* Sillage — app-shell service worker (cache-first for same-origin assets) */
const CACHE = 'sillage-shell-v6';
const PRECACHE = [
  '/Sillage/',
  '/Sillage/index.html',
  '/Sillage/manifest.webmanifest',
  '/Sillage/favicon.svg',
  '/Sillage/pwa-192.png',
  '/Sillage/pwa-512.png',
  '/Sillage/apple-touch-icon.png',
  '/Sillage/fonts/cormorant-garamond-latin-400-italic.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-400-normal.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-500-italic.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-500-normal.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-600-italic.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-600-normal.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-ext-400-italic.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-ext-400-normal.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-ext-500-italic.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-ext-500-normal.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-ext-600-italic.woff2',
  '/Sillage/fonts/cormorant-garamond-latin-ext-600-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-300-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-400-italic.woff2',
  '/Sillage/fonts/source-sans-3-latin-400-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-500-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-600-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-ext-300-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-ext-400-italic.woff2',
  '/Sillage/fonts/source-sans-3-latin-ext-400-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-ext-500-normal.woff2',
  '/Sillage/fonts/source-sans-3-latin-ext-600-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => {
      // First install: take over now. Later updates wait for « Mettre à jour ».
      if (!self.registration.active) {
        return self.skipWaiting();
      }
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isAppShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  if (!url.pathname.startsWith('/Sillage/')) return false;
  // Skip opaque/third-party; only same-origin under base
  const path = url.pathname;
  if (
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.svg') ||
    path.endsWith('.png') ||
    path.endsWith('.webp') ||
    path.endsWith('.woff2') ||
    path.endsWith('.woff') ||
    path.endsWith('.ttf') ||
    path.endsWith('.webmanifest') ||
    path.endsWith('.ico') ||
    path === '/Sillage/' ||
    path.endsWith('/index.html')
  ) {
    return true;
  }
  // Hashed Vite assets under /Sillage/assets/
  if (path.includes('/Sillage/assets/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Do not cache third-party origins
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put('/Sillage/index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('/Sillage/index.html').then((r) => r || caches.match('/Sillage/')),
        ),
    );
    return;
  }

  if (!isAppShellRequest(url)) return;

  // Cache-first for app shell assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    }),
  );
});
