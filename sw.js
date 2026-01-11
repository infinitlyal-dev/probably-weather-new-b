/* Probably Weather — Service Worker (versioned + safe updates)
   Goals:
   - Prevent mixed old/new builds causing UI "haywire"
   - Network-first for HTML/JS/CSS
   - Stale-while-revalidate for images
*/

const SW_VERSION = 'pw-v5'; // Bumped to v5 for app restoration
const CORE_CACHE = `${SW_VERSION}-core`;
const IMG_CACHE = `${SW_VERSION}-img`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/assets/app.css',
  '/assets/app.js',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove old caches
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(SW_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isHtml(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

function isCoreAsset(url) {
  return (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json'
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache API responses
  if (url.pathname.startsWith('/api/')) return;

  // HTML + core assets: NETWORK FIRST (prevents Franken-builds)
  if (isHtml(req) || isCoreAsset(url)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CORE_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // fallback to cached index if navigation fails
        if (isHtml(req)) {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
        }
        return new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Images: STALE-WHILE-REVALIDATE
  if (req.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);

      const fetchPromise = fetch(req).then((fresh) => {
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      }).catch(() => null);

      return cached || (await fetchPromise) || new Response('', { status: 504 });
    })());
    return;
  }

  // Default: try network, fallback cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Optional: allow the page to trigger an update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});