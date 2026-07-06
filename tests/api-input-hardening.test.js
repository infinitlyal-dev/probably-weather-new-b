// Tests for the API input-hardening changes (SECURITY_AUDIT #1, #2, #3-adjacent,
// #6 is config-only). Every NEW rejection path is covered here:
//   - api/weather.js  : out-of-range lat/lon (forward AND reverse), over-length name
//   - api/geocode.js  : out-of-range lat/lon (reverse), over-length q
//   - api/errors.js   : cross-origin / origin-less POST rejection, allowed-origin accept
//
// All rejection paths return BEFORE any upstream fetch, so these tests need no
// network mock. geocode.js requires LOCATIONIQ_TOKEN to be set before it reaches
// the new guards (it short-circuits to 200 when the token is absent), so those
// tests stub the env — the rejections still fire before the token is ever used.

import { afterEach, describe, expect, it, vi } from 'vitest';

import weatherHandler from '../api/weather.js';
import geocodeHandler from '../api/geocode.js';
import errorsHandler from '../api/errors.js';

const APP_ORIGIN = 'https://www.probablyweather.co.za';
const APEX_ORIGIN = 'https://probablyweather.co.za';

function makeRes() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers.set(String(k).toLowerCase(), v); return this; },
    json(v) { this.body = v; return this; },
    end(v) { this.ended = true; if (v !== undefined) this.body = v; return this; },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// api/weather.js — coordinate bounds + name length
// ---------------------------------------------------------------------------
describe('api/weather.js input hardening', () => {
  const callWeather = async (query) => {
    const res = makeRes();
    await weatherHandler({ query }, res);
    return res;
  };

  it('rejects out-of-range latitude (forward path) with 400, before any provider call', async () => {
    const res = await callWeather({ lat: '99999', lon: '18' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
  });

  // codex finding 2026-05-30: parseFloat partial-parses '90abc'→90 and '0x10'→0,
  // which would slip past the range check. parseCoord must reject these.
  it('rejects partial-numeric lat (90abc) that parseFloat would have accepted', async () => {
    const res = await callWeather({ lat: '90abc', lon: '18' });
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('Invalid lat/lon');
  });

  it('rejects hex-style coord (0x10) that parseFloat would coerce to 0', async () => {
    const res = await callWeather({ lat: '0x10', lon: '18' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects scientific-notation coord (1e3) — not a plain decimal', async () => {
    const res = await callWeather({ lat: '1e3', lon: '18' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects array-valued lat (?lat=1&lat=2 → array on Vercel) with 400', async () => {
    const res = await callWeather({ lat: ['1', '2'], lon: '18' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a trailing-junk lon (18!!) with 400', async () => {
    const res = await callWeather({ lat: '-34', lon: '18!!' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects out-of-range longitude (forward path) with 400', async () => {
    const res = await callWeather({ lat: '-34', lon: '999' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects lat just past the pole (90.0001) but lets the 90/180 boundary through the guard', async () => {
    const over = await callWeather({ lat: '90.0001', lon: '0' });
    expect(over.statusCode).toBe(400);

    // 90 / 180 are valid edges — they must NOT trip the bounds guard. The guard
    // returns 400 SYNCHRONOUSLY before any network call. Stub fetch to reject
    // instantly so the boundary call never leaves the machine: unstubbed, the
    // handler fanned out to all five real providers (9s timeouts each), which
    // intermittently blew vitest's 5s test timeout under the full parallel run
    // — this was the source of the suite's flake, not the guard logic.
    const fetchStub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline (test stub)'));
    const edge = makeRes();
    try {
      await weatherHandler({ query: { lat: '90', lon: '180' } }, edge);
    } catch { /* downstream failure is fine — the guard already passed */ }
    fetchStub.mockRestore();
    expect(edge.statusCode).not.toBe(400);
  });

  it('rejects non-finite coords (existing behaviour preserved)', async () => {
    const res = await callWeather({ lat: 'abc', lon: 'def' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects out-of-range coords on the reverse path (?reverse=1) before LocationIQ', async () => {
    const res = await callWeather({ reverse: '1', lat: '99999', lon: '-99999' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
  });

  it('rejects an over-length name with 400 (valid coords, long name)', async () => {
    const res = await callWeather({ lat: '-34', lon: '18', name: 'x'.repeat(121) });
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/name/i);
  });

  it('does NOT reject a name at the 120-char boundary on the name guard', async () => {
    // 120 chars is the allowed maximum. The name guard returns 400 synchronously
    // before any network call, so if it had fired we'd see 400 deterministically.
    // Tolerate a downstream network rejection and assert only that the guard
    // itself let the boundary-length name through.
    const res = makeRes();
    try {
      await weatherHandler({ query: { lat: '-34', lon: '18', name: 'a'.repeat(120) } }, res);
    } catch { /* downstream network failure is fine — the guard already passed */ }
    expect(res.statusCode).not.toBe(400);
    // 20s timeout: this test intentionally lets the REAL aggregation run (live
    // provider fetches) — under the 5s vitest default it flaked whenever the
    // slowest provider took >5s (observed 5023ms failures on 2026-07-06).
  }, 20000);
});

// ---------------------------------------------------------------------------
// api/geocode.js — reverse coordinate bounds + search query length
// ---------------------------------------------------------------------------
describe('api/geocode.js input hardening', () => {
  const callGeocode = async (query) => {
    const res = makeRes();
    await geocodeHandler({ query }, res);
    return res;
  };

  it('rejects out-of-range coords on reverse with 400 (token present, before LocationIQ)', async () => {
    vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
    const res = await callGeocode({ type: 'reverse', lat: '99999', lon: '18' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
  });

  it('rejects partial-numeric reverse coords (90abc) — parseCoord, not parseFloat', async () => {
    vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
    const res = await callGeocode({ type: 'reverse', lat: '90abc', lon: '18' });
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('Invalid lat/lon');
  });

  it('rejects array-valued reverse lat with 400', async () => {
    vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
    const res = await callGeocode({ type: 'reverse', lat: ['1', '2'], lon: '18' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an over-length search q with 400', async () => {
    vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
    const res = await callGeocode({ type: 'search', q: 'x'.repeat(121) });
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/too long/i);
  });

  it('still returns empty (200) for a too-short q — existing behaviour preserved', async () => {
    vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
    const res = await callGeocode({ type: 'search', q: 'a' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, results: [] });
  });

  it('does NOT reject a 120-char q on the length guard (boundary allowed)', async () => {
    vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
    // Force the LocationIQ fetch to throw so we never hit the network; the
    // handler degrades to its graceful 200 catch. The point: no 400 too-long.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('blocked-by-test'); }));
    const res = await callGeocode({ type: 'search', q: 'a'.repeat(120) });
    expect(res.statusCode).not.toBe(400);
  });
});

// ---------------------------------------------------------------------------
// api/errors.js — origin gating (was an open CORS:* sink)
// ---------------------------------------------------------------------------
describe('api/errors.js origin gating', () => {
  const callErrors = async ({ method = 'POST', headers = {}, body = {} } = {}) => {
    const res = makeRes();
    await errorsHandler({ method, headers, body }, res);
    return res;
  };

  it('accepts a same-origin POST (Origin = app) with 204', async () => {
    const res = await callErrors({ headers: { origin: APP_ORIGIN }, body: { message: 'x' } });
    expect(res.statusCode).toBe(204);
  });

  it('accepts the apex origin too', async () => {
    const res = await callErrors({ headers: { origin: APEX_ORIGIN }, body: { message: 'x' } });
    expect(res.statusCode).toBe(204);
  });

  it('accepts when Origin is absent but Referer is the app (Safari same-origin fallback)', async () => {
    const res = await callErrors({ headers: { referer: `${APP_ORIGIN}/?lat=-34&lon=18` }, body: { message: 'x' } });
    expect(res.statusCode).toBe(204);
  });

  it('rejects a cross-origin POST (Origin = evil) with 403', async () => {
    const res = await callErrors({ headers: { origin: 'https://evil.example.com' }, body: { message: 'x' } });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a POST with NO Origin and NO Referer (curl / script) with 403', async () => {
    const res = await callErrors({ headers: {}, body: { message: 'x' } });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a cross-origin Referer fallback with 403', async () => {
    const res = await callErrors({ headers: { referer: 'https://evil.example.com/x' }, body: { message: 'x' } });
    expect(res.statusCode).toBe(403);
  });

  it('does not send a permissive Access-Control-Allow-Origin (never "*")', async () => {
    const res = await callErrors({ headers: { origin: APP_ORIGIN }, body: { message: 'x' } });
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).not.toBe('*');
    expect(acao).toBe(APP_ORIGIN); // reflects the validated origin only
  });

  it('OPTIONS preflight from an allowed origin returns 204 with reflected ACAO', async () => {
    const res = await callErrors({ method: 'OPTIONS', headers: { origin: APP_ORIGIN } });
    expect(res.statusCode).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  it('OPTIONS preflight from a disallowed origin returns 204 WITHOUT an ACAO grant', async () => {
    const res = await callErrors({ method: 'OPTIONS', headers: { origin: 'https://evil.example.com' } });
    expect(res.statusCode).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeUndefined();
  });

  it('rejects a non-POST method with 405', async () => {
    const res = await callErrors({ method: 'GET', headers: { origin: APP_ORIGIN } });
    expect(res.statusCode).toBe(405);
  });
});
