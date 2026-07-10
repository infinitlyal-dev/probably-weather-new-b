/* Probably Weather — Service Worker v17
   Upgrades from v16 — THE update-propagation fix:
   - Every deploy now changes sw.js's bytes: scripts/build.mjs injects the Vercel
     commit SHA into the BUILD_ID constant below. This fixes the field failure
     where an already-installed app kept running the PREVIOUS deploy's code — a
     share still used the old /?bg= path after the web build had refreshed.
   - Root cause (why v16 silently stopped propagating app-only deploys): the shell
     is served stale-while-revalidate, which serves the OLD app.js on the open it
     runs and only caches the new one for the NEXT open — always one open behind.
     The skipWaiting → activate → clients.claim → controllerchange → one-reload
     flow (still present + correct below) would have closed that gap, BUT it only
     fires when the browser detects a NEW SW, and a deploy that touched only app.js
     left sw.js byte-identical, so registration.update() saw the same script and
     NO new SW ever installed. The missing ingredient was never the cache version —
     it was that sw.js itself had to change so the install runs at all.
   - The fix is deliberately minimal: BUILD_ID makes sw.js byte-differ every deploy.
     On the next update check the browser installs the new SW; its install-time
     addAll REFETCHES and OVERWRITES the shell (index.html, app.js, …) IN PLACE in
     the existing same-named cache (Cache.put replaces matching entries); activate
     → clients.claim → the page's controllerchange handler reloads once onto the
     fresh shell. CACHE_VERSION is still NOT bumped, and that is correct: same cache
     identity, overwrite-in-place, so the image/api caches are never touched (no
     re-download churn). The atomic addAll must complete before skipWaiting runs;
     any precache failure rejects installation so the old worker and complete shell
     stay in control until the next update check retries.
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

// Per-deploy build stamp. scripts/build.mjs rewrites __BUILD_ID__ to the Vercel
// commit SHA on every production build, so the shipped sw.js differs byte-for-byte
// every deploy — the ONLY thing that makes an already-installed browser notice a
// new SW and run the update flow (install → activate → clients.claim →
// controllerchange → one reload). Unbuilt (tests, vercel dev, python preview) it
// stays the literal placeholder. It is referenced in activate's diagnostic log so
// minification keeps it (and the build's __BUILD_ID__ presence check guards it).
const BUILD_ID = '__BUILD_ID__';

// Cache identity is STABLE across deploys. The new SW's install-time addAll
// overwrites the shell in place (Cache.put replaces matching entries), so a code
// deploy refreshes app.js/index.html/etc. without a version bump — and the image
// cache (the big payload) is never re-downloaded. Bump this literal BY HAND only
// to deliberately invalidate caches. (Tests pin the literal + its date format.)
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
  // __CLIENT_BUNDLE_ASSETS_START__
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
  '/assets/witty-day-tags.js',
  '/assets/geo-regions.js',
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
  '/assets/search-mini-weather.js',
  '/assets/install-loader.js',
  // __CLIENT_BUNDLE_ASSETS_END__
  '/manifest.json',
];

// 1,008-image rotation space (9 conditions × 4 weeks × 4 time-slots × 7 picks).
// Cap raised from 60 → 120 so a typical user's recently-seen buckets survive
// week-boundary transitions instead of churning on every rollover.
const MAX_IMG_CACHE = 120;
const MAX_API_CACHE = 60;
const MAX_OG_CACHE = 32;
const API_CACHE_MAX_AGE = 3 * 60 * 60 * 1000; // 3 hours

// How long install waits before precaching. Covers the page's paint-critical
// window (HTML + CSS + JS over a slow mobile link) so the ~25-asset addAll
// never competes with first paint — see v16 header note.
const PRECACHE_YIELD_MS = 4000;

// Set during install: true when a cache already existed, i.e. a prior SW ran
// here (an UPDATE), false on a first-ever install. activate uses it to decide
// whether to broadcast PW_UPDATE_AVAILABLE — the reload fallback for clients
// whose `controllerchange` event never fires (notably iOS standalone PWAs).
// Because cache names are stable across deploys, oldCaches is empty on a routine
// same-CACHE_VERSION deploy, so oldCaches.length alone can no longer tell an
// update apart from a first install — this flag does.
let hadPriorCaches = false;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Read BEFORE we open our own cache (open would create one). Any existing
    // cache ⇒ a prior SW ran here ⇒ this is an update, not a first install.
    hadPriorCaches = (await caches.keys()).length > 0;
    await new Promise((resolve) => setTimeout(resolve, PRECACHE_YIELD_MS));
    try {
      const cache = await caches.open(CORE_CACHE);
      // Cache.addAll is atomic: any failed core request rejects without
      // overwriting a subset of the stable shell cache. Do not activate until
      // the complete graph is present.
      await cache.addAll(CORE_ASSETS);
    } catch (err) {
      console.warn('[SW] core precache failed; install aborted:', err?.message || err);
      // A failed first-ever install creates an empty cache via caches.open().
      // Remove it so the next attempt is still recognised as a first install.
      // On updates, preserve the prior worker's complete stable cache.
      if (!hadPriorCaches) await caches.delete(CORE_CACHE).catch(() => {});
      throw err;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldCaches = keys.filter((k) => !k.startsWith(CACHE_VERSION));
    await Promise.all(oldCaches.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Surface the active SW version + build on the console for diagnostics —
    // visible via Application → Service Workers in DevTools, or via
    // navigator.serviceWorker.controller?.scriptURL inspection. Referencing
    // BUILD_ID here also keeps minification from dropping the const (see its
    // docblock); the reload path is driven by controllerchange on the page.
    console.log('[SW] Activated', CACHE_VERSION, 'build', BUILD_ID, '— purged', oldCaches.length, 'old caches');
    // Broadcast on ANY real update (a prior SW existed), not only when caches
    // were purged. Cache names are stable across deploys, so a routine deploy
    // clears no caches — yet the page still needs the belt-and-braces reload
    // signal for the case where `controllerchange` silently doesn't fire (iOS
    // standalone). Gated by hadPriorCaches so a first-ever install never posts
    // it (which would reload the user on their first visit).
    if (hadPriorCaches || oldCaches.length) {
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

async function trimCache(cacheName, maxItems, shouldInclude = () => true) {
  const cache = await caches.open(cacheName);
  const keys = (await cache.keys()).filter(shouldInclude);
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
    let cacheMaintenance = Promise.resolve();
    const responsePromise = (async () => {
      let fresh = null;
      try {
        fresh = await fetch(req);
        if (fresh.ok) {
          const cache = await caches.open(API_CACHE);
          const headers = new Headers(fresh.headers);
          headers.set('sw-cached-at', Date.now().toString());
          const cachedResponse = new Response(await fresh.clone().blob(), {
            status: fresh.status,
            statusText: fresh.statusText,
            headers,
          });
          cacheMaintenance = cache.put(req, cachedResponse)
            .then(() => trimCache(API_CACHE, MAX_API_CACHE))
            .catch(() => {});
          return fresh;
        }
      } catch {
        // A rejected fetch and a non-OK HTTP response share the same cached
        // fallback below. `fresh` stays null only for the rejected-fetch case.
      }

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
        await cache.delete(req).catch(() => {});
        // Cached payload too old — fall through to the network error or the
        // 503 below so the page never renders over-age weather as current.
      }
      if (fresh) return fresh;
      return new Response(JSON.stringify({ ok: false, error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    })();
    event.respondWith(responsePromise);
    // Keep the worker alive after the network response is released so the
    // write and cap enforcement cannot be cut short by worker termination.
    event.waitUntil(responsePromise.then(() => cacheMaintenance, () => cacheMaintenance));
    return;
  }

  // Dynamic OG images: STALE-WHILE-REVALIDATE
  if (url.pathname.startsWith('/api/og')) {
    let revalidationPromise = Promise.resolve(null);
    let cacheMaintenance = Promise.resolve();
    const responsePromise = (async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);
      revalidationPromise = fetch(req).then((fresh) => {
        if (fresh.ok) {
          cacheMaintenance = cache.put(req, fresh.clone())
            .then(() => trimCache(IMG_CACHE, MAX_OG_CACHE, (key) => new URL(key.url).pathname === '/api/og'))
            .catch(() => {});
        }
        return fresh;
      }).catch(() => null);
      return cached || (await revalidationPromise) || new Response('', { status: 504 });
    })();
    event.respondWith(responsePromise);
    // A cached OG response returns immediately; keep its network revalidation,
    // cache write, and subspace trim alive in the background.
    event.waitUntil(
      responsePromise
        .then(() => revalidationPromise, () => revalidationPromise)
        .then(() => cacheMaintenance, () => cacheMaintenance)
    );
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
    let revalidationPromise = Promise.resolve(null);
    let cacheMaintenance = Promise.resolve();
    const responsePromise = (async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);

      revalidationPromise = fetch(req).then((fresh) => {
        // Restrict caching to fully-loaded 200 responses. fresh.ok also matches
        // 206 Partial Content (range requests), which would cache a partial
        // image as if it were the full asset.
        if (fresh.status === 200) {
          cacheMaintenance = cache.put(req, fresh.clone())
            .then(() => trimCache(IMG_CACHE, MAX_IMG_CACHE, (key) => new URL(key.url).pathname !== '/api/og'))
            .catch(() => {});
        }
        return fresh;
      }).catch(() => null);

      return cached || (await revalidationPromise) || new Response('', { status: 504 });
    })();
    event.respondWith(responsePromise);
    event.waitUntil(
      responsePromise
        .then(() => revalidationPromise, () => revalidationPromise)
        .then(() => cacheMaintenance, () => cacheMaintenance)
    );
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
