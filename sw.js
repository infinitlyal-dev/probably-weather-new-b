/* Probably Weather — Service Worker v7
   Upgrades from v6:
   - Force cache bust after deployment pipeline fix
   - All previous features retained
*/

const SW_VERSION = 'pw-v7';
const CORE_CACHE = `${SW_VERSION}-core`;
const IMG_CACHE = `${SW_VERSION}-img`;
const API_CACHE = `${SW_VERSION}-api`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/assets/app.css',
  '/assets/app.js',
  '/manifest.json',
];

const MAX_IMG_CACHE = 60;
const API_CACHE_MAX_AGE = 3 * 60 * 60 * 1000; // 3 hours

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
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

function isWeatherApi(url) {
  return url.pathname.startsWith('/api/weather') && !url.searchParams.has('reverse');
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Weather API: NETWORK FIRST, cache for offline
  if (isWeatherApi(url)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          const cache = await caches.open(API_CACHE);
          const headers = new Headers(fresh.headers);
          headers.set('sw-cached-at', Date.now().toString());
          const cachedResponse = new Response(await fresh.clone().blob(), {
            status: fresh.status,
            statusText: fresh.statusText,
            headers,
          });
          cache.put(req, cachedResponse).catch(() => {});
        }
        return fresh;
      } catch {
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(req);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set('sw-offline', 'true');
          return new Response(await cached.blob(), {
            status: cached.status,
            statusText: cached.statusText,
            headers,
          });
        }
        return new Response(JSON.stringify({ ok: false, error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

  // Reverse geocode: pass through
  if (url.pathname.startsWith('/api/')) return;

  // HTML + core assets: NETWORK FIRST
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
        if (isHtml(req)) {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
        }
        return new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Images: STALE-WHILE-REVALIDATE (caches bg images on first load)
  if (req.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);

      const fetchPromise = fetch(req).then((fresh) => {
        if (fresh.ok) {
          cache.put(req, fresh.clone()).catch(() => {});
          trimCache(IMG_CACHE, MAX_IMG_CACHE).catch(() => {});
        }
        return fresh;
      }).catch(() => null);

      return cached || (await fetchPromise) || new Response('', { status: 504 });
    })());
    return;
  }

  // Default: network, fallback cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
