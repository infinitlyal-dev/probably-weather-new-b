// Every LocationIQ call from /api/geocode spends a slot of the global
// 'locationiq' budget first (2026-09-15). Production logged 14 LocationIQ HTTP
// 429s here: a debounced keystroke costs a ZA query plus an unrestricted
// fallback, and the free plan allows 2 requests a second.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const budget = vi.hoisted(() => ({ answers: [] }));

vi.mock('../api/_lib/provider-budget.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    consumeProviderBudgets: vi.fn(async (providers) => {
      const allowed = budget.answers.length ? budget.answers.shift() : true;
      return Object.fromEntries(providers.map((p) => [p, allowed]));
    }),
  };
});

import geocodeHandler from '../api/geocode.js';

const makeRes = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const call = async (query) => {
  const res = makeRes();
  await geocodeHandler({ query, headers: {} }, res);
  return res;
};

let fetches;
beforeEach(() => {
  budget.answers = [];
  fetches = [];
  vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token');
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    fetches.push(href);
    // No ZA match (LocationIQ's documented 404), so the unrestricted retry runs.
    if (href.includes('countrycodes=za')) return { ok: false, status: 404, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => [{ display_name: 'Moscow, Russia', lat: '55.75', lon: '37.61', address: { city: 'Moscow', country: 'Russia' } }],
    };
  }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/api/geocode spends the LocationIQ budget before every upstream call', () => {
  it('a refused slot answers busy without calling LocationIQ, and is not cacheable', async () => {
    budget.answers = [false];
    const res = await call({ type: 'search', q: 'mosco' });
    expect(res.body).toEqual({ ok: false, error: 'Geocoding busy', results: [] });
    expect(fetches).toEqual([]);
    expect(res.headers['Cache-Control']).toBeUndefined();
  });

  it('the unrestricted retry spends its own slot; refused, the keystroke is busy — never a cached empty 200', async () => {
    budget.answers = [true, false];
    const res = await call({ type: 'search', q: 'mosco' });
    expect(fetches).toHaveLength(1);
    expect(fetches[0]).toContain('countrycodes=za');
    expect(res.body).toEqual({ ok: false, error: 'Geocoding busy', results: [] });
    expect(res.headers['Cache-Control']).toBeUndefined();
  });

  it('with both slots granted, the ZA query and the fallback run and the answer is cacheable', async () => {
    const res = await call({ type: 'search', q: 'mosco' });
    expect(fetches).toHaveLength(2);
    expect(res.body.ok).toBe(true);
    expect(res.body.results[0].name).toBe('Moscow');
    expect(res.headers['Cache-Control']).toMatch(/s-maxage=300/);
  });

  it('a reverse lookup spends a slot too', async () => {
    budget.answers = [false];
    const res = await call({ type: 'reverse', lat: '-34.1', lon: '18.8' });
    expect(res.body).toEqual({ ok: false, error: 'Geocoding busy', results: [] });
    expect(fetches).toEqual([]);
  });
});
