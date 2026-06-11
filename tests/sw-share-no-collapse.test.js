// Group 0 (Codex finding) — /share is a server-rendered, QUERY-DEPENDENT route
// (api/share.js bakes a per-coordinate og:image + a per-coordinate
// `location.replace('/?lat=…')` redirect into the HTML body). The SW HTML
// branch must therefore NEVER collapse distinct /share?lat= navigations under
// one cache entry, or opening one share link would serve — and redirect to —
// a different coordinate.
//
// The static shell ('/', '/index.html', '/install*') is the opposite: its body
// is query-independent (read at runtime from location.search), so query
// variants SHARE one entry by design. This test pins both behaviours.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, beforeEach } from 'vitest';

const ORIGIN = 'https://probablyweather.co.za';

// A Map-backed CacheStorage that honours { ignoreSearch } the way the real
// Cache API does (match by pathname, ignoring the query string).
function makeCaches() {
  const buckets = new Map();
  const bucket = (name) => {
    if (!buckets.has(name)) buckets.set(name, new Map());
    const m = buckets.get(name);
    return {
      async match(req, opts = {}) {
        const u = new URL(typeof req === 'string' ? req : req.url);
        if (opts.ignoreSearch) {
          for (const [k, v] of m) if (new URL(k).pathname === u.pathname) return v;
          return undefined;
        }
        return m.get(u.href);
      },
      async put(req, res) {
        m.set(new URL(typeof req === 'string' ? req : req.url).href, res);
      },
      async keys() { return [...m.keys()].map((url) => ({ url })); },
    };
  };
  return {
    _buckets: buckets,
    open: async (name) => bucket(name),
    match: async () => undefined,
    keys: async () => [...buckets.keys()],
  };
}

function loadSW(caches, fetchImpl) {
  let fetchHandler = null;
  const context = {
    self: {
      addEventListener(type, fn) { if (type === 'fetch') fetchHandler = fn; },
      skipWaiting() {}, clients: { claim() {} },
      location: { origin: ORIGIN },
    },
    caches, URL, Headers, Response, Request,
    fetch: fetchImpl,
    Promise, Date, console,
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  return { dispatch: makeDispatch(() => fetchHandler) };
}

function makeDispatch(getHandler) {
  return async (path) => {
    const request = new Request(ORIGIN + path, { headers: { accept: 'text/html' } });
    let captured;
    getHandler()({ request, respondWith(p) { captured = p; } });
    const res = await captured;
    return res ? await res.text() : null;
  };
}

// fetch returns a body that uniquely identifies the requested URL, so any
// cross-contamination is visible in the returned text.
const echoFetch = async (req) => {
  const u = typeof req === 'string' ? req : req.url;
  return new Response(`BODY ${u}`, { status: 200, headers: { 'content-type': 'text/html' } });
};

describe('SW /share must not collapse query-distinct navigations', () => {
  let caches, dispatch;
  beforeEach(() => { caches = makeCaches(); ({ dispatch } = loadSW(caches, echoFetch)); });

  it('two different /share?lat= URLs each get their OWN body (no collapse)', async () => {
    const a = await dispatch('/share?lat=-34.1&lon=18.8');
    const b = await dispatch('/share?lat=-26.2&lon=28.0');
    expect(a).toContain('lat=-34.1');
    expect(b).toContain('lat=-26.2');
    // The Joburg link must NOT serve the Cape Town body.
    expect(b).not.toContain('lat=-34.1');
  });

  it('a repeated /share?lat= URL is served fresh-or-its-own (exact key), never a sibling', async () => {
    await dispatch('/share?lat=-34.1&lon=18.8');      // primes exact entry
    const again = await dispatch('/share?lat=-34.1&lon=18.8');
    expect(again).toContain('lat=-34.1');
    const other = await dispatch('/share?lat=10.0&lon=10.0');
    expect(other).toContain('lat=10.0');
    expect(other).not.toContain('lat=-34.1');
  });

  it('/share is cached under its EXACT query-bearing key, not a stripped /share', async () => {
    await dispatch('/share?lat=-34.1&lon=18.8');
    const core = caches._buckets.get([...caches._buckets.keys()].find((k) => k.includes('core')));
    const keys = [...(core?.keys?.() ?? [])];
    // No bare canonical '/share' entry was written.
    const hasStripped = [...core.keys()].some((u) => new URL(u).pathname === '/share' && !new URL(u).search);
    expect(hasStripped).toBe(false);
  });
});

describe('SW shell pages still share one entry (ignoreSearch) by design', () => {
  let caches, dispatch;
  beforeEach(() => { caches = makeCaches(); ({ dispatch } = loadSW(caches, echoFetch)); });

  it("'/' query variants collapse to one cached shell (the v15 win, scoped correctly)", async () => {
    const first = await dispatch('/?lat=-34.1&lon=18.8&lang=af'); // caches under canonical '/'
    expect(first).toContain('lat=-34.1');
    // Second variant hits the cached '/' via ignoreSearch → shares the body.
    const second = await dispatch('/?lat=-26.2&lon=28.0&lang=en');
    expect(second).toContain('lat=-34.1'); // intentionally the shared shell body
  });
});
