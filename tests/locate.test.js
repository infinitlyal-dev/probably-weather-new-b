// /api/locate — IP geolocation from Vercel's x-vercel-ip-* headers.
// Replaces the third-party ipapi.co call on the first-open critical path.

import { describe, expect, it } from 'vitest';

import locateHandler from '../api/locate.js';

function makeRes() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers.set(String(k).toLowerCase(), v); return this; },
    json(v) { this.body = v; return this; },
  };
}

const call = (headers) => {
  const res = makeRes();
  locateHandler({ headers }, res);
  return res;
};

describe('/api/locate', () => {
  it('returns rounded coords + "City, CC" name from Vercel geo headers', () => {
    const res = call({
      'x-vercel-ip-latitude': '-34.1163',
      'x-vercel-ip-longitude': '18.8362',
      'x-vercel-ip-city': 'Cape%20Town',
      'x-vercel-ip-country': 'za',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, lat: -34.1, lon: 18.8, name: 'Cape Town, ZA' });
  });

  it('rounds to 1 decimal place — privacy posture of the old ipapi path', () => {
    const res = call({ 'x-vercel-ip-latitude': '-26.2041', 'x-vercel-ip-longitude': '28.0473' });
    expect(res.body.lat).toBe(-26.2);
    expect(res.body.lon).toBe(28.0);
  });

  it('decodes the percent-encoded city header', () => {
    const res = call({
      'x-vercel-ip-latitude': '-33.9',
      'x-vercel-ip-longitude': '18.4',
      'x-vercel-ip-city': 'Somerset%20West',
      'x-vercel-ip-country': 'ZA',
    });
    expect(res.body.name).toBe('Somerset West, ZA');
  });

  it('survives a malformed (undecodable) city header by passing it through raw', () => {
    const res = call({
      'x-vercel-ip-latitude': '-33.9',
      'x-vercel-ip-longitude': '18.4',
      'x-vercel-ip-city': '%E0%A4%A',  // broken escape — decodeURIComponent throws
      'x-vercel-ip-country': 'ZA',
    });
    expect(res.body.ok).toBe(true);
    expect(res.body.name).toBe('%E0%A4%A, ZA');
  });

  it('returns ok:false with no geo headers (local dev / non-Vercel runtime)', () => {
    expect(call({}).body).toEqual({ ok: false });
    const res = makeRes();
    locateHandler({}, res); // no headers object at all
    expect(res.body).toEqual({ ok: false });
  });

  it('returns ok:false for junk or out-of-range header values', () => {
    expect(call({ 'x-vercel-ip-latitude': 'abc', 'x-vercel-ip-longitude': '18' }).body.ok).toBe(false);
    expect(call({ 'x-vercel-ip-latitude': '91', 'x-vercel-ip-longitude': '18' }).body.ok).toBe(false);
    expect(call({ 'x-vercel-ip-latitude': '-34', 'x-vercel-ip-longitude': '181' }).body.ok).toBe(false);
  });

  it('city-only (no country) name omits the suffix; coords-only name is null', () => {
    const cityOnly = call({ 'x-vercel-ip-latitude': '-34', 'x-vercel-ip-longitude': '18', 'x-vercel-ip-city': 'Strand' });
    expect(cityOnly.body.name).toBe('Strand');
    const coordsOnly = call({ 'x-vercel-ip-latitude': '-34', 'x-vercel-ip-longitude': '18' });
    expect(coordsOnly.body.name).toBe(null);
  });

  it('is never edge-cached cross-user (private, no-store)', () => {
    const res = call({ 'x-vercel-ip-latitude': '-34', 'x-vercel-ip-longitude': '18' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});
