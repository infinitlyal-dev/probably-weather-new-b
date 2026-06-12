/* Probably Weather — Service Worker v16
   Upgrades from v15:
   - Install-time precache now starts after a 4s PRECACHE_YIELD_MS delay. On
     the one open where a device upgrades from a pre-SWR SW (v14 and older,
     network-first shell), the page's own critical fetches (HTML, app.css,
     app.js — all blocking first paint through the OLD SW) used to compete
     with this SW's ~25-asset addAll on the same mobile link. The delay hands
     the link to first paint; precache (and therefore activate → the silent
     controllerchange reload) runs a few seconds later, which the user never
     sees. Devices already on a SWR SW paint from cache instantly, so the
     delay costs them nothing.
   - CACHE_VERSION again NOT bumped: install addAll refetches every core asset
     fresh (including the updated index.html) into the existing cache, and the
     SWR runtime refresh keeps doing so on every open — a bump would only
     force needless precache churn on every device.
   Upgrades from v14:
   - App shell (HTML + core assets) switched from NETWORK-FIRST to
     STALE-WHILE-REVALIDATE. The cached shell is served immediately so the
     app paints on every open without waiting on the network; a background
     fetch refreshes the cache and the update paints on the NEXT open.
     This removes the once-per-deploy white-screen: on the first open after a
     CACHE_VERSION bump the page now paints instantly from the old cache while
     the new SW precaches the new shell in the background, instead of racing a
     network fetch for render-blocking HTML/CSS.
   - Weather data is UNAFFECTED — /api/weather keeps its own network-first
     branch above, so forecasts are still fetched fresh on every open. Only the
     app shell (which only changes on deploy) is served cache-first.
   - CACHE_VERSION intentionally NOT bumped: no cached asset content changed,
     only SW routing logic, which propagates via the SW byte diff on next
     launch (vercel.json forces /sw.js revalidation). The existing caches stay
     valid; bumping would force a needless precache churn.
   - Asset paths are stable (/assets/app.js, not hashed), so serving a cached
     index.html alongside cached assets can never reference a missing hash —
     the classic SWR footgun does not apply here.
   Cache-Control: no-cache, no-store, must-revalidate on /sw.js (vercel.json)
   ensures the browser ALWAYS revalidates the SW script on each update check.
*/

const CACHE_VERSION = 'pw-v2026-05-31-001';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const IMG_CACHE = `${CACHE_VERSION}-img`;
const API_CACHE = `${CACHE_VERSION}-api`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/install',
  '/install.html',
  '/assets/app.css',
  '/assets/app.js',
  // Every ES module app.js imports — the offline shell white-screens if any is
  // missing (app.js loads from cache, then its first un-cached `import` rejects).
  '/assets/install.js',
  '/assets/startup-location.js',
  '/assets/coord-parse.js',
  '/assets/language-preferences.js',
  // Per-language copy banks (Group 6): app.js dynamically imports ONE per
  // session via copy-loader.js, but all five are precached (~200 KB once at
  // install) so offline language switching keeps working. The old monolith
  // /assets/weather-copy.js is server-side only now — not precached.
  '/assets/copy-loader.js',
  '/assets/weekend-filter.js',
  '/assets/copy/en.js',
  '/assets/copy/af.js',
  '/assets/copy/zu.js',
  '/assets/copy/xh.js',
  '/assets/copy/st.js',
  '/assets/weather-visuals.js',
  '/assets/image-picker.js',
  '/assets/weather-emoji.js',
  '/assets/share-url.js',
  '/assets/refresh-behaviour.js',
  '/assets/first-open-location.js',
  '/assets/home-name.js',
  '/assets/weather-thresholds.js',
  '/manifest.json',
];

// 1,008-image rotation space (9 conditions × 4 weeks × 4 time-slots × 7 picks).
// Cap raised from 60 → 120 so a typical user's recently-seen buckets survive
// week-boundary transitions instead of churning on every rollover.
const MAX_IMG_CACHE = 120;
const API_CACHE_MAX_AGE = 3 * 60 * 60 * 1000; // 3 hours

// How long install waits before precaching. Covers the page's paint-critical
// window (HTML + CSS + JS over a slow mobile link) so the ~25-asset addAll
// never competes with first paint — see v16 header note.
const PRECACHE_YIELD_MS = 4000;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    await new Promise((resolve) => setTimeout(resolve, PRECACHE_YIELD_MS));
    try {
      const cache = await caches.open(CORE_CACHE);
      // addAll is atomic — if any single asset fails, the cache is left empty.
      // Try the atomic path first so we either get the full offline shell or
      // none of it, but if that fails fall back to a best-effort per-asset
      // loop that logs each miss. Both outcomes leave the SW installed; the
      // log surfaces missing assets to anyone watching the console after a
      // deploy.
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        const cached = new Set();
        for (const asset of CORE_ASSETS) {
          try {
            await cache.add(asset);
            cached.add(asset);
          } catch (assetErr) {
            console.warn('[SW] core asset failed to cache:', asset, assetErr?.message || assetErr);
          }
        }
        console.warn('[SW] core precache partial:', cached.size, '/', CORE_ASSETS.length, 'assets cached; addAll error:', err?.message || err);
      }
    } catch (err) {
      console.warn('[SW] core cache open failed:', err?.message || err);
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldCaches = keys.filter((k) => !k.startsWith(CACHE_VERSION));
    await Promise.all(oldCaches.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Surface the active SW version on the console for diagnostic purposes —
    // visible via Application → Service Workers in DevTools, or via
    // navigator.serviceWorker.controller?.scriptURL inspection.
    console.log('[SW] Activated', CACHE_VERSION, '— purged', oldCaches.length, 'old caches');
    if (oldCaches.length) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        // Include the new cache version so the page can stash it in
        // sessionStorage before reloading and surface it in the post-reload
        // acknowledgment toast (or in debug-overlay output).
        client.postMessage({ type: 'PW_UPDATE_AVAILABLE', version: CACHE_VERSION });
      });
    }
  })());
});

function isHtml(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

// Derived from CORE_ASSETS so the runtime "network-first + cache" routing can
// never drift out of sync with the precache list — that drift is exactly what
// left 8 of app.js's 10 imported modules uncached and broke the offline shell.
const CORE_ASSET_PATHS = new Set(CORE_ASSETS);
function isCoreAsset(url) {
  return CORE_ASSET_PATHS.has(url.pathname);
}

// The static, query-INDEPENDENT shell pages — these read location.search at
// runtime, so their HTML body is identical for any query string. ONLY these
// may be served with ignoreSearch (query variants share one cached entry).
// Query-dependent navigations like /share (server-rendered per-coordinate)
// must never be collapsed — see the HTML branch in the fetch handler.
const SHELL_PAGES = new Set(['/', '/index.html', '/install', '/install.html']);
function isShellPage(url) {
  return SHELL_PAGES.has(url.pathname);
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
          // Honour API_CACHE_MAX_AGE — if the offline copy is older than the
          // cap, refuse to serve it. Showing 3+ hour stale weather as a
          // confident offline mode is worse than a clear "offline" error,
          // especially for SA testers driving between regions on the N2.
          const cachedAt = Number.parseInt(cached.headers.get('sw-cached-at') || '0', 10);
          const age = Number.isFinite(cachedAt) && cachedAt > 0 ? Date.now() - cachedAt : Infinity;
          if (age <= API_CACHE_MAX_AGE) {
            const headers = new Headers(cached.headers);
            headers.set('sw-offline', 'true');
            headers.set('sw-cache-age-ms', String(age));
            return new Response(await cached.blob(), {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            });
          }
          // Cached payload too old — fall through to the 503 below so the page
          // can render an explicit offline state rather than stale data.
        }
        return new Response(JSON.stringify({ ok: false, error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

  // Dynamic OG images: STALE-WHILE-REVALIDATE
  if (url.pathname.startsWith('/api/og')) {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((fresh) => {
        if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      }).catch(() => null);
      return cached || (await fetchPromise) || new Response('', { status: 504 });
    })());
    return;
  }

  // Reverse geocode: pass through
  if (url.pathname.startsWith('/api/')) return;

  // HTML + core assets: STALE-WHILE-REVALIDATE
  // Serve the cached shell instantly (no network wait → no white screen),
  // refresh the cache in the background, paint the update on the next open.
  // Weather freshness is handled by the /api/weather branch above; the shell
  // itself only changes on deploy, so serving it cache-first is safe.
  if (isHtml(req) || isCoreAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      // ignoreSearch + canonical (query-stripped) write-back apply ONLY to the
      // static, query-INDEPENDENT shell pages (isShellPage). Their HTML is
      // identical for any query — they read location.search at runtime — so a
      // '/?lat=…&lon=…&lang=af' share-open can safely share the precached '/'
      // entry, and variants must not accumulate.
      //
      // A query-DEPENDENT navigation like /share must NOT be collapsed: it is
      // server-rendered (/api/share) with a per-coordinate og:image and a
      // per-coordinate `location.replace('/?lat=…')` redirect baked into the
      // body. Under ignoreSearch + canonical write-back, opening
      // /share?lat=<B> after /share?lat=<A> served <A>'s body and redirected
      // to <A>'s location (Codex finding). Non-shell HTML therefore matches
      // and writes back under its EXACT, query-bearing URL.
      const shell = isShellPage(url);
      const cached = await cache.match(req, shell ? { ignoreSearch: true } : undefined);

      const fetchPromise = fetch(req).then((fresh) => {
        if (fresh && fresh.ok) {
          const writeReq = shell ? new Request(new URL(url.pathname, url.origin).href) : req;
          cache.put(writeReq, fresh.clone()).catch(() => {});
        }
        return fresh;
      }).catch(() => null);

      if (cached) {
        // Background refresh; never block first paint on it.
        fetchPromise.catch(() => {});
        return cached;
      }

      // Nothing cached for this request yet (first-ever visit, or an asset the
      // atomic precache missed) — fall back to the network.
      const fresh = await fetchPromise;
      if (fresh) return fresh;

      // Offline with no cached copy of this exact request.
      if (isHtml(req)) {
        const cachedIndex = await cache.match('/index.html');
        if (cachedIndex) return cachedIndex;
      }
      return new Response('Offline', { status: 503 });
    })());
    return;
  }

  // Images: STALE-WHILE-REVALIDATE (caches bg images on first load)
  if (req.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);

      const fetchPromise = fetch(req).then((fresh) => {
        // Restrict caching to fully-loaded 200 responses. fresh.ok also matches
        // 206 Partial Content (range requests), which would cache a partial
        // image as if it were the full asset.
        if (fresh.status === 200) {
          cache.put(req, fresh.clone()).catch(() => {});
          trimCache(IMG_CACHE, MAX_IMG_CACHE).catch(() => {});
        }
        return fresh;
      }).catch(() => null);

      return cached || (await fetchPromise) || new Response('', { status: 504 });
    })());
    return;
  }

  // Default: network, fallback cache. The fallback must never resolve to
  // undefined — respondWith(undefined) is a TypeError that surfaces as a
  // generic network error. A cache miss now returns an explicit 504.
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch {
      return (await caches.match(req)) || new Response('', { status: 504 });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
