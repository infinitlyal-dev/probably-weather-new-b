// Per-IP rate limiting — endpoint wiring: when the limiter blocks, each
// endpoint returns 429 with JSON matching its existing error shape. The limiter
// module is mocked to a blocking limiter, so no real Upstash and no network: the
// rate-limit check is the first thing each handler does and returns before any
// upstream fetch.

import { describe, expect, it, vi } from 'vitest';

const blocking = { limit: async () => ({ success: false }) };
vi.mock('../api/_lib/limiters.js', () => ({
  weatherLimiter: () => blocking,
  geocodeLimiter: () => blocking,
  errorsLimiter: () => blocking,
  RATE_LIMITS: {},
  _resetLimiters: () => {},
}));

const { default: weatherHandler } = await import('../api/weather.js');
const { default: geocodeHandler } = await import('../api/geocode.js');
const { default: errorsHandler } = await import('../api/errors.js');

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
  it('/api/weather → 429 { ok:false, error }', async () => {
    const res = makeRes();
    await weatherHandler({ headers: IP, query: { lat: '-33.92', lon: '18.42' } }, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ ok: false, error: 'Too many requests' });
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

  it('/api/errors still rejects a cross-origin POST BEFORE rate limiting (403, not 429)', async () => {
    const res = makeRes();
    await errorsHandler({ method: 'POST', headers: { origin: 'https://evil.example', ...IP }, body: { message: 'x' } }, res);
    expect(res.statusCode).toBe(403); // origin gate runs first; limiter never consulted
  });
});
