// Our own traffic (own=1) — Al, 27 Sept 2026: in one day the live app answered 276 weather requests,
// almost all our accuracy recorder and checks; Tomorrow.io was skipped on 91 of them and the town-name
// lookup on some, leaving real users short. The flag can only shorten what a request gets:
//   · no LocationIQ call (the name lookup, or ?reverse=1) — and today's server already skips the lookup
//     for a read that brings its own &name=, without ever caching that name for anyone else;
//   · Tomorrow.io under a cap of its own (OWN_TRAFFIC_BUDGETS), spent before the global budget, so real
//     traffic still gets Tomorrow.io once our cap is spent;
//   · an answer that is never the cell's cached copy and never edge-cached (no degraded answer for a
//     real user), from a read that never leads the cell or takes its lock (no real user waits on it).
import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ redis: null }));
vi.mock('../api/_lib/limiters.js', () => ({
  getRedis: () => fake.redis,
  weatherLimiter: () => null,
  weatherDailyLimiter: () => null,
  geocodeLimiter: () => null,
  errorsLimiter: () => null,
  ogLimiter: () => null,
  RATE_LIMITS: {},
}));

import handler from '../api/weather.js';
import { weatherCacheGet, weatherCacheKey } from '../api/_lib/weather-cache.js';
import {
  OWN_TRAFFIC_BUDGETS,
  PROVIDER_BUDGETS,
  _resetInstanceBudget,
  consumeOwnTrafficBudgets,
  consumeProviderBudgets,
} from '../api/_lib/provider-budget.js';

// An in-memory Upstash stand-in: the cache (get/set/del), the lock (set nx; eval release), the admission
// counters (mget; eval) and the budget script — emulated in JS on its own keys (pw-budget:…), refusing
// with minus the window's index as the Lua does. Every other eval is "allowed / done".
function fakeRedis() {
  const store = new Map();
  const r = {
    store,
    setCalls: [],
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async mget(...keys) { return keys.map((k) => (store.has(k) ? store.get(k) : null)); },
    async set(k, v, opts = {}) { r.setCalls.push({ key: k, value: v, opts }); if (opts.nx && store.has(k)) return null; store.set(k, v); return 'OK'; },
    async del(k) { return store.delete(k) ? 1 : 0; },
    async incr(k) { const n = (store.get(k) ?? 0) + 1; store.set(k, n); return n; },
    async decr(k) { const n = (store.get(k) ?? 0) - 1; store.set(k, n); return n; },
    async incrby(k, n) { const v = (store.get(k) ?? 0) + n; store.set(k, v); return v; },
    async expire() { return 1; },
    async eval(script, keys, args) {
      if (!String(keys?.[0] || '').startsWith('pw-budget:')) return 1;
      for (let i = 0; i < keys.length; i++) {
        const ceiling = Number(args[i * 3]);
        const revert = Number(args[i * 3 + 2]);
        const count = await r.incr(keys[i]);
        if (count > ceiling) { if (revert === 1) await r.decr(keys[i]); return -(i + 1); }
      }
      return 1;
    },
  };
  return r;
}

const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const openMeteoPayload = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
  hourly: {
    temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18), precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(12), cloud_cover: Array(48).fill(10), relative_humidity_2m: Array(48).fill(50),
    uv_index: Array(48).fill(4), weather_code: Array(48).fill(0), visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(8),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(12), precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(6),
    weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-09-27T06:30'), sunset: Array(7).fill('2026-09-27T18:15'),
  },
};
const metPayload = {
  properties: {
    timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 8, 27, i, 0, 0)).toISOString(),
      data: {
        instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } },
        next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
      },
    })),
  },
};
const tomorrowPayload = {
  data: {
    timelines: [{
      timestep: '1h',
      intervals: Array.from({ length: 48 }, (_, i) => ({
        startTime: new Date(Date.UTC(2026, 8, 27, i, 0, 0)).toISOString(),
        values: { temperature: 18, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 3, humidity: 50, cloudCover: 10, visibility: 10 },
      })),
    }],
  },
};

let calls = [];
const stubFetch = () => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
    if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
    if (href.includes('api.tomorrow.io/')) return makeResponse(tomorrowPayload);
    if (href.includes('locationiq.com/')) return makeResponse({ address: { town: 'Strand', state: 'Western Cape', country_code: 'za' } });
    throw new Error(`Unexpected URL: ${href}`);
  }));
};
const hits = (s) => calls.filter((u) => u.includes(s)).length;
// The cell's cached copies (fresh + stale) — not the lock, which shares the key prefix and is the only nx set.
const cacheWrites = () => fake.redis.setCalls.filter((c) => String(c.key).startsWith('pw-wx:') && !c.opts?.nx);
const lockTaken = () => fake.redis.setCalls.some((c) => c.opts?.nx);

const STRAND = { lat: '-34.1163', lon: '18.8362' };
const call = async (query) => {
  let statusCode = 200;
  let body;
  const headers = {};
  const req = { query };
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { statusCode, body, headers };
};

beforeEach(() => {
  fake.redis = fakeRedis();
  _resetInstanceBudget();
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  delete process.env.OPEN_METEO_API_KEY;
  delete process.env.PW_SOURCES_OFF;
  process.env.LOCATIONIQ_TOKEN = 'liq-key';
  stubFetch();
});

afterEach(() => {
  delete process.env.LOCATIONIQ_TOKEN;
  delete process.env.TOMORROWIO_API_KEY;
  delete process.env.PW_TEST_REAL_BUDGET;
  fake.redis = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('own=1 — our own traffic never uses LocationIQ and is never a real user\'s answer', () => {
  it('a placeholder-named own read: no LocationIQ call, not cached for the cell, not edge-cached, no lock taken; the next real read fetches whole and caches', async () => {
    const own = await call({ ...STRAND, own: '1' });
    expect(own.statusCode).toBe(200);
    expect(own.body.ok).toBe(true);
    expect(hits('locationiq.com')).toBe(0);
    expect(own.headers['Cache-Control']).toBe('no-store');
    expect(cacheWrites()).toHaveLength(0);
    expect(lockTaken()).toBe(false);

    const real = await call({ ...STRAND, name: '' });
    expect(real.statusCode).toBe(200);
    expect(hits('open-meteo.com')).toBe(2);           // the real user fetched for themselves
    expect(hits('locationiq.com')).toBe(1);           // …and got their name looked up
    expect(real.body.location.name).toBe('Strand, Western Cape');
    expect(real.headers['Cache-Control']).toMatch(/s-maxage/);
    expect(cacheWrites().length).toBeGreaterThan(0);
    expect(lockTaken()).toBe(true);
  });

  it('today\'s server: a read that brings its own &name= makes no LocationIQ call, and that name is never the cell\'s cached name', async () => {
    const r = await call({ ...STRAND, name: 'Cape Town' });
    expect(r.statusCode).toBe(200);
    expect(hits('locationiq.com')).toBe(0);
    expect(r.body.location.name).toBe('Cape Town');
    expect(cacheWrites().length).toBeGreaterThan(0);
    const cached = await weatherCacheGet(weatherCacheKey(-34.1163, 18.8362), fake.redis);
    expect(cached.location.name).toBe('Unknown');
  });

  it('own=1&reverse=1 answers "no name" without calling LocationIQ; a real reverse lookup still does', async () => {
    const own = await call({ ...STRAND, reverse: '1', own: '1' });
    expect(own.statusCode).toBe(200);
    expect(own.body.ok).toBe(false);
    expect(hits('locationiq.com')).toBe(0);
    const real = await call({ ...STRAND, reverse: '1' });
    expect(real.body.ok).toBe(true);
    expect(real.body.city).toBe('Strand');
    expect(hits('locationiq.com')).toBe(1);
  });
});

describe('the own cap on Tomorrow.io (OWN_TRAFFIC_BUDGETS)', () => {
  const NOW = 1_790_000_000_000;

  it('is 4 an hour and 96 a day — well under a quarter of the 500/day and a small share of the 25/hour', () => {
    expect(OWN_TRAFFIC_BUDGETS.tomorrow).toEqual({ perHour: 4, perDay: 96 });
    expect(OWN_TRAFFIC_BUDGETS.tomorrow.perDay).toBeLessThan(PROVIDER_BUDGETS.tomorrow.perDay / 4);
    expect(OWN_TRAFFIC_BUDGETS.tomorrow.perHour).toBeLessThanOrEqual(PROVIDER_BUDGETS.tomorrow.perHour / 5);
  });

  it('consumeOwnTrafficBudgets: four in an hour, the fifth refused; it spends nothing global; providers without an own cap are not in the result', async () => {
    const redis = fakeRedis();
    for (let i = 0; i < 4; i++) {
      const r = await consumeOwnTrafficBudgets(['tomorrow', 'met'], redis, NOW + i * 1000);
      expect(r).toEqual({ tomorrow: true });
    }
    const fifth = await consumeOwnTrafficBudgets(['tomorrow', 'met'], redis, NOW + 5000);
    expect(fifth).toEqual({ tomorrow: false });
    expect([...redis.store.keys()].every((k) => k.startsWith('pw-budget:own:tomorrow:'))).toBe(true);
    // The global budget is whole: a real request still gets Tomorrow.io.
    expect((await consumeProviderBudgets(['tomorrow'], redis, NOW + 6000)).tomorrow).toBe(true);
    expect(await consumeOwnTrafficBudgets(['met'], redis, NOW)).toEqual({});
  });

  it('a global refusal names its window (perSecond), out of sight of the provider map', async () => {
    const redis = fakeRedis();
    for (let i = 0; i < 3; i++) expect((await consumeProviderBudgets(['tomorrow'], redis, NOW)).tomorrow).toBe(true);
    const fourth = await consumeProviderBudgets(['tomorrow'], redis, NOW);
    expect(fourth).toEqual({ tomorrow: false });
    expect(Object.keys(fourth)).toEqual(['tomorrow']);
    expect(fourth.refusedWindow.tomorrow).toBe('perSecond');
  });

  it('handler: own=1 gets Tomorrow.io until the own cap and not after, while a real request still gets it', async () => {
    process.env.TOMORROWIO_API_KEY = 'tio-key';
    process.env.PW_TEST_REAL_BUDGET = '1';
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = new Date('2026-09-27T09:10:00Z').getTime();
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(t0 + i * 1000);                 // a second apart: inside Tomorrow.io's 3 a second
      const r = await call({ ...STRAND, own: '1', name: 'Strand' });
      expect(r.statusCode).toBe(200);
      expect(hits('api.tomorrow.io')).toBe(i + 1);
      expect(r.body.meta.sources.find((s) => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: true });
    }
    vi.setSystemTime(t0 + 4000);
    const fifth = await call({ ...STRAND, own: '1', name: 'Strand' });
    expect(fifth.statusCode).toBe(200);
    expect(hits('api.tomorrow.io')).toBe(4);                                   // the own cap, not the global one
    expect(fifth.body.meta.sources.find((s) => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: false });
    expect(cacheWrites()).toHaveLength(0);                                     // none of the five own reads was cached
    vi.setSystemTime(t0 + 5000);
    const real = await call({ ...STRAND, name: '' });
    expect(real.statusCode).toBe(200);
    expect(hits('api.tomorrow.io')).toBe(5);                                   // real traffic still gets it
    expect(real.body.meta.sources.find((s) => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: true });
    expect(cacheWrites().length).toBeGreaterThan(0);
  });
});

describe('the recorder sends the flag', () => {
  it('record.mjs reads with own=1 and the place\'s name, one read every 0.4 s', () => {
    const src = readFileSync(new URL('../review/accuracy/live/record.mjs', import.meta.url), 'utf8');
    expect(src).toMatch(/&own=1&name=\$\{encodeURIComponent\(c\.name\)\}/);
    expect(src).toMatch(/const STAGGER_MS = 400/);
    expect(src).not.toMatch(/api\/weather\?lat=\$\{c\.lat\}&lon=\$\{c\.lon\}`/);
  });
});
