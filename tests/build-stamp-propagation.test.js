// Build-stamp update propagation (Task 1).
//
// The field failure: an already-installed PWA kept running the PREVIOUS deploy's
// code (a share still used the old /?bg= path) because app-only deploys never
// changed sw.js, so the browser never detected a new SW and the whole
// skipWaiting → activate → clients.claim → controllerchange → reload flow never
// fired. The fix stamps the commit SHA into a BUILD_ID placeholder in sw.js (and
// inline in app.js) so sw.js bytes change every deploy. Cache identity stays
// STABLE — the new SW's install-time addAll overwrites the shell in place, so
// images aren't re-downloaded and the shell cache is never emptied (offline-safe).
//
// This file proves the wiring (static), the propagation trigger (different SHA →
// different sw.js bytes), and the behaviour (a simulated two-deploy lifecycle:
// shell overwritten with fresh code, images preserved, shell never emptied, and
// PW_UPDATE_AVAILABLE broadcast on any real update — the iOS controllerchange
// fallback — but never on a first-ever install).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const buildSrc = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Wiring — the static contract that keeps the mechanism intact
// ---------------------------------------------------------------------------

describe('sw.js build-stamp wiring', () => {
  it('defines a BUILD_ID from the injected placeholder', () => {
    expect(swSource).toMatch(/const BUILD_ID = '__BUILD_ID__'/);
  });

  it('references BUILD_ID at runtime so minification cannot drop it', () => {
    // Declaration line excluded — there must be a SECOND occurrence (the use).
    const uses = swSource.match(/BUILD_ID/g) || [];
    expect(uses.length).toBeGreaterThan(1);
  });

  it('keeps cache identity STABLE (all keyed by CACHE_VERSION → overwrite-in-place, no churn)', () => {
    expect(swSource).toMatch(/const CORE_CACHE = `\$\{CACHE_VERSION\}-core`/);
    expect(swSource).toMatch(/const IMG_CACHE = `\$\{CACHE_VERSION\}-img`/);
    expect(swSource).toMatch(/const API_CACHE = `\$\{CACHE_VERSION\}-api`/);
  });

  it('keeps CACHE_VERSION as the pinned storage-version literal', () => {
    expect(swSource).toMatch(/const CACHE_VERSION = 'pw-v2026-05-31-001'/);
  });
});

describe('propagation trigger — every deploy ships different sw.js bytes', () => {
  it('two different SHAs produce different sw.js source (browser detects a new SW)', () => {
    expect(swSource.replaceAll('__BUILD_ID__', 'aaaaaaa'))
      .not.toBe(swSource.replaceAll('__BUILD_ID__', 'bbbbbbb'));
  });
});

describe('scripts/build.mjs stamps + guards the placeholder', () => {
  it('rewrites __BUILD_ID__ using VERCEL_GIT_COMMIT_SHA (fallback local)', () => {
    expect(buildSrc).toMatch(/process\.env\.VERCEL_GIT_COMMIT_SHA \|\| 'local'/);
    expect(buildSrc).toMatch(/replaceAll\('__BUILD_ID__', buildId\)/);
  });

  it('stamps BOTH sw.js and assets/app.js', () => {
    expect(buildSrc).toMatch(/\['sw\.js', 'assets\/app\.js'\]/);
  });

  it('FATALs if the placeholder is missing (never ship a shell that cannot self-update)', () => {
    expect(buildSrc).toMatch(/!source\.includes\('__BUILD_ID__'\)/);
    expect(buildSrc).toMatch(/process\.exit\(1\)/);
  });
});

describe('app.js consumes BUILD_ID (inline, not a separate imported module)', () => {
  it('declares an inline BUILD_ID placeholder the build stamps', () => {
    expect(appSrc).toMatch(/const BUILD_ID = '__BUILD_ID__'/);
  });

  it('does NOT import a separate build-info module (would add a hard offline-boot dep)', () => {
    expect(appSrc).not.toMatch(/from '\.\/build-info\.js'/);
  });

  it('shows the running build SHA in Settings (#appVersion)', () => {
    expect(appSrc).toMatch(/Version \$\{APP_VERSION\} · Build \$\{BUILD_SHORT\}/);
  });

  it('the update banner compares the running BUILD_ID against the live /api/version', () => {
    const fn = appSrc.match(/function setupVersionBanner\(\)\s*\{[\s\S]*?\n  \}/)[0];
    expect(fn).toMatch(/server !== BUILD_ID/);
    expect(fn).toMatch(/isBuiltBuildId/);
  });
});

// ---------------------------------------------------------------------------
// Behaviour — simulated two-deploy lifecycle against a shared fake Cache Storage
// ---------------------------------------------------------------------------

// A fake Cache Storage that persists across "deploys" (as real Cache Storage
// does). addAll/add stores `${buildId}:${url}` as the body so we can prove which
// deploy populated the shell — and that a later deploy OVERWRITES it in place.
function makeCacheStore() {
  const store = new Map(); // cacheName -> Map(url -> body)
  const makeCaches = (buildId) => ({
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name);
      return {
        async addAll(list) { for (const u of list) c.set(u, `${buildId}:${u}`); },
        async add(u) { c.set(u, `${buildId}:${u}`); },
        async put(req, res) { c.set(typeof req === 'string' ? req : req.url, res); },
        async match(req) { return c.get(typeof req === 'string' ? req : req.url); },
        async keys() { return [...c.keys()]; },
        async delete(u) { return c.delete(u); },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); },
    async match() { return undefined; },
  });
  return { store, makeCaches };
}

// Load sw.js as a specific deploy, capture its lifecycle handlers + any client
// messages, and return drivers for install/activate.
function loadDeploy(buildId, makeCaches) {
  const handlers = {};
  const postedMessages = [];
  const fakeClient = { postMessage: (m) => postedMessages.push(m) };
  const context = {
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => {},
      clients: {
        claim: async () => {},
        matchAll: async () => [fakeClient],
      },
      location: { origin: 'https://probablyweather.co.za' },
    },
    caches: makeCaches(buildId),
    fetch: async () => new Response('ok', { status: 200 }),
    setTimeout: (fn) => { fn(); return 0; }, // collapse PRECACHE_YIELD_MS
    URL, Headers, Response, Promise, Date, console, Set,
  };
  vm.createContext(context);
  vm.runInContext(swSource.replaceAll('__BUILD_ID__', buildId), context);

  const drive = async (type) => {
    const waited = [];
    handlers[type]({ waitUntil: (p) => waited.push(p) });
    await Promise.all(waited);
  };
  return { drive, postedMessages };
}

const SHELL = 'pw-v2026-05-31-001-core';
const IMG = 'pw-v2026-05-31-001-img';
const UPDATE_MSG = { type: 'PW_UPDATE_AVAILABLE', version: 'pw-v2026-05-31-001' };

describe('two-deploy lifecycle: stale SW → new deploy → next open runs new code', () => {
  it('overwrites the shell with fresh code IN PLACE, PRESERVES images, never empties the shell, and broadcasts the reload signal', async () => {
    const { store, makeCaches } = makeCacheStore();

    // Deploy A installs + activates, then the user browses and downloads images.
    const a = loadDeploy('deployAAA', makeCaches);
    await a.drive('install');
    await a.drive('activate');
    store.set(IMG, new Map([['/assets/images/bg/clear/day_1.webp', 'IMG-BYTES']]));

    expect(store.get(SHELL).get('/assets/app.js')).toBe('deployAAA:/assets/app.js');
    const shellSizeAfterA = store.get(SHELL).size;
    expect(shellSizeAfterA).toBeGreaterThan(20); // the full core module graph

    // Deploy B ships (new SHA → new sw.js bytes → new SW installs + activates).
    const b = loadDeploy('deployBBB', makeCaches);
    await b.drive('install');
    await b.drive('activate');

    // Shell OVERWRITTEN in place (same cache name) with FRESH deploy-B code — so
    // the next open serves the new app.js.
    expect(store.get(SHELL).get('/assets/app.js')).toBe('deployBBB:/assets/app.js');
    // Shell never emptied — still the full core set (offline boot stays safe).
    expect(store.get(SHELL).size).toBe(shellSizeAfterA);
    // The money assertion: images survived the deploy untouched — no re-download.
    expect(store.get(IMG).get('/assets/images/bg/clear/day_1.webp')).toBe('IMG-BYTES');
    // Belt-and-braces reload signal DOES fire on this same-CACHE_VERSION update
    // (a prior SW existed) — the iOS-controllerchange fallback. This is the fix
    // for the "no message on routine deploy" gap.
    expect(b.postedMessages).toContainEqual(UPDATE_MSG);
  });

  it('first-ever install does NOT broadcast PW_UPDATE_AVAILABLE (no prior SW → no first-visit reload)', async () => {
    const { makeCaches } = makeCacheStore();
    const first = loadDeploy('deployAAA', makeCaches);
    await first.drive('install');
    await first.drive('activate');
    expect(first.postedMessages).toHaveLength(0);
  });

  it('a manual CACHE_VERSION bump still purges superseded caches and broadcasts an update', async () => {
    const { store, makeCaches } = makeCacheStore();
    const a = loadDeploy('deployAAA', makeCaches);
    await a.drive('install');
    await a.drive('activate');
    // A cache left over from an earlier CACHE_VERSION (simulates a manual bump).
    store.set('pw-v2026-05-01-001-core', new Map([['/index.html', 'OLD']]));

    const b = loadDeploy('deployBBB', makeCaches);
    await b.drive('install');
    await b.drive('activate');

    expect(store.has('pw-v2026-05-01-001-core')).toBe(false); // purged
    expect(b.postedMessages).toContainEqual(UPDATE_MSG);
  });
});
