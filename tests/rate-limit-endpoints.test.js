// Per-IP rate limiting — endpoint wiring: when the limiter blocks, each
// endpoint returns 429 with JSON matching its existing error shape. The limiter
// module is mocked to a blocking limiter, so no real Upstash and no network: the
// rate-limit check is the first thing each handler does and returns before any
// upstream fetch.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const blocking = { limit: vi.fn(async () => ({ success: false })) };
const allowing = { limit: vi.fn(async () => ({ success: true, remaining: 299 })) };
vi.mock('../api/_lib/limiters.js', () => ({
  geocodeLimiter: () => blocking,
  errorsLimiter: () => blocking,
  ogLimiter: () => blocking,
  // weather-cache.js rides this client; null = no Redis, so the cache and the
  // distributed lock both fail open and the admission gate below is reachable.
  getRedis: () => null,
  RATE_LIMITS: {},
}));

// /api/weather's four (or eight, with ?reverse=1) allowance counters are not
// @upstash/ratelimit limiters any more — they are one atomic Lua EVAL in
// _lib/admission.js (item 1, round 5). Wiring is asserted at that seam.
let weatherPeek = false;
let weatherCharge = false;
let reversePeek = false;
let reverseCharge = false;
vi.mock('../api/_lib/admission.js', async (importOriginal) => {
  const mod = await importOriginal();
  const isReverse = (buckets) => buckets === mod.REVERSE_ADMISSION;
  return {
    ...mod,
    peekAdmission: vi.fn(async (buckets) => (isReverse(buckets) ? reversePeek : weatherPeek)),
    // PRODUCTION SHAPE. chargeAdmission returns { allowed, billed, token } —
    // a bare boolean made `false` and `true` both read as refused through
    // outcome.allowed, so the charge-refusal assertions were vacuous.
    chargeAdmission: vi.fn(async (buckets) => {
      const allowed = isReverse(buckets) ? reverseCharge : weatherCharge;
      return allowed
        ? { allowed: true, billed: true, token: 'test-token' }
        : { allowed: false, billed: false, token: null };
    }),
  };
});

const { default: weatherHandler } = await import('../api/weather.js');
const { default: geocodeHandler } = await import('../api/geocode.js');
const { default: errorsHandler } = await import('../api/errors.js');
const { default: ogHandler } = await import('../api/og.js');

const APP_ORIGIN = 'https://www.probablyweather.co.za';

function makeRes() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers.set(String(k).toLowerCase(), v); return this; },
    json(v) { this.body = v; return this; },
    end(v) { this.body = v; return this; },
  };
}

const IP = { 'x-forwarded-for': '41.2.3.4' };

describe('rate-limited endpoints return 429 (matching the existing error shape) when blocked', () => {
  beforeEach(() => {
    weatherPeek = false;
    weatherCharge = false;
    reversePeek = false;
    reverseCharge = false;
    vi.clearAllMocks();
  });

  it('/api/weather → 429 { ok:false, error }', async () => {
    const res = makeRes();
    await weatherHandler({ headers: IP, query: { lat: '-33.92', lon: '18.42' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests' });
  });

  // Item 1 moved every weather bucket behind the cache and the coalescing
  // layers, so none of them fires on a request that never reaches the upstream
  // path. S1 used to be pinned with lat/lon 'bad', which now correctly gets the
  // 400 the coordinate guard owes it.
  it('S1 /api/weather is refused by the non-consuming PRE-CHECK, before leadership', async () => {
    weatherPeek = false;   // no allowance left
    weatherCharge = true;
    const res = makeRes();
    await weatherHandler(
      { headers: { ...IP, 'x-pw-install': 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }, query: { lat: '-33.92', lon: '18.42' } },
      res,
    );
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests' });
  });

  it('S1b /api/weather is refused by the atomic CHARGE when the peek passed', async () => {
    weatherPeek = true;    // allowance at peek time...
    weatherCharge = false; // ...gone by charge time (the race)
    const res = makeRes();
    await weatherHandler({ headers: IP, query: { lat: '-33.92', lon: '18.42' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests' });
  });

  it('S1c /api/weather ?reverse=1 is gated by its OWN buckets', async () => {
    // An exhausted FORECAST allowance must not block a position fix, and vice
    // versa: the two families are independent.
    weatherPeek = true;
    weatherCharge = true;
    reversePeek = false;
    const res = makeRes();
    await weatherHandler({ headers: IP, query: { reverse: '1', lat: '-33.92', lon: '18.42' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests' });
  });

  it('S1d CONTROL: with admission allowed the weather handler reaches its body', async () => {
    // Without this the refusal assertions above prove nothing — a mock that
    // refuses everything would satisfy them just as well.
    weatherPeek = true;
    weatherCharge = true;
    reversePeek = true;
    reverseCharge = true;
    const res = makeRes();
    await weatherHandler({ headers: IP, query: { lat: '-33.92', lon: '18.42' } }, res);
    expect(res.statusCode).not.toBe(429);
  });

  it('/api/geocode → 429 { ok:false, error, results:[] } (search-compatible)', async () => {
    const res = makeRes();
    await geocodeHandler({ headers: IP, query: { type: 'search', q: 'cape town' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests', results: [] });
  });

  it('/api/errors (valid-origin POST) → 429 { ok:false, error }', async () => {
    const res = makeRes();
    await errorsHandler({ method: 'POST', headers: { origin: APP_ORIGIN, ...IP }, body: { message: 'x' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests' });
  });

  it('/api/og → 429 before weather lookup or image rendering', async () => {
    const res = makeRes();
    await ogHandler({ headers: IP, query: { lang: 'en' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toBe('Too many requests');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('/api/errors still rejects a cross-origin POST BEFORE rate limiting (403, not 429)', async () => {
    const res = makeRes();
    await errorsHandler({ method: 'POST', headers: { origin: 'https://evil.example', ...IP }, body: { message: 'x' } }, res);
    expect(res.statusCode).toBe(403); // origin gate runs first; limiter never consulted
  });
});
