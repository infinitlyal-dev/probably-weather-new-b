// Prelaunch item 3, round 8 (Astra): when a cache hit is REFUSED (the hour's
// UV crossed a rung, so the cached headline no longer holds), lock losers that
// poll Redis must not take the same refused entry straight back and fan out
// for themselves. Three handler INSTANCES (separate module copies, like three
// Vercel invocations) share one fake Redis; after the refusal exactly one
// five-provider fan-out happens and the other two are served the leader's
// replacement.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const makeFakeRedis = () => {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async set(key, value, opts) {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async del(key) { store.delete(key); return 1; },
    async eval(script, keys, args) {
      // RELEASE_LOCK_SCRIPT: delete only when the token matches.
      if (String(script).includes("redis.call('del'")) {
        if (store.get(keys[0]) === args[0]) { store.delete(keys[0]); return 1; }
        return 0;
      }
      return 1;
    },
    async incr() { return 1; },
    async expire() { return 1; },
  };
};

const makeResponse = (payload, status = 200) => ({ ok: status < 300, status, json: async () => payload });

// Open-Meteo hourly UV: 0.2 everywhere, 8.6 at noon → 11:59 clear, 12:01 uv headline.
const uvIndex = Array(48).fill(0.2); uvIndex[12] = 8.6;
const openMeteoPayload = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
  hourly: {
    temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18), precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(12), cloud_cover: Array(48).fill(10), relative_humidity_2m: Array(48).fill(50),
    uv_index: uvIndex, weather_code: Array(48).fill(0), visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(8),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(12), precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(8.6),
    weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-05-19T06:00'), sunset: Array(7).fill('2026-05-19T18:00'),
  },
};
const metPayload = {
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
    data: { instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } },
  })) },
};

const fakeRedis = makeFakeRedis();
vi.mock('../api/_lib/limiters.js', () => ({
  getRedis: () => fakeRedis,
  // Item 1 split the flat weather limiters into forecast/reverse families;
  // null limiter → fail-open, so this file exercises coalescing, not limits.
  weatherMinuteInstallLimiter: () => null, weatherDailyInstallLimiter: () => null,
  weatherMinuteIpLimiter: () => null, weatherDailyIpLimiter: () => null,
  reverseMinuteInstallLimiter: () => null, reverseDailyInstallLimiter: () => null,
  reverseMinuteIpLimiter: () => null, reverseDailyIpLimiter: () => null,
  geocodeLimiter: () => null, errorsLimiter: () => null, ogLimiter: () => null,
  RATE_LIMITS: {},
}));

// A fresh module copy of the handler = one Vercel instance (its own in-flight map).
const instance = async () => { vi.resetModules(); return (await import('../api/weather.js')).default; };

const call = async (handler) => {
  let statusCode = 200; let body;
  const res = { setHeader() {}, status(c) { statusCode = c; return this; }, json(p) { body = p; return this; } };
  await handler({ query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } }, res);
  return { statusCode, body };
};

const stubProviders = (delayMs) => {
  const fn = vi.fn(async (url) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    const href = String(url);
    if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
    if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
    throw new Error(`Unexpected URL: ${href}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY;
  fakeRedis.store.clear();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('item 3 — a refused cache entry does not defeat cross-instance coalescing', () => {
  it('11:59 entry (clear) read at 12:01 (uv rung) by three instances → one fan-out, two coalesced', async () => {
    // Seed: instance A writes the 11:59 entry through the real cache writer.
    vi.setSystemTime(new Date('2026-05-19T09:59:00Z'));
    stubProviders(0);
    const seeded = await call(await instance());
    expect(seeded.body.meta.serverCache).toBe('miss');
    expect(seeded.body.now.conditionKey).not.toBe('uv');
    await new Promise((r) => setTimeout(r, 30)); // the deferred SET settles
    expect([...fakeRedis.store.keys()].some((k) => k.startsWith('pw-wx:'))).toBe(true);

    // 12:01: the cached headline no longer holds (hour 12 uv 8.6 → uv rung).
    vi.setSystemTime(new Date('2026-05-19T10:01:00Z'));
    const fetchFn = stubProviders(60);
    // Sequential on purpose: each reset+import must complete before the next, or they share one module copy.
    const b = await instance(); const c = await instance(); const d = await instance();
    const results = await Promise.all([call(b), call(c), call(d)]);
    for (const r of results) {
      expect(r.statusCode).toBe(200);
      expect(r.body.now.conditionKey).toBe('uv');
      expect(r.body.now.uv).toBe(8.6);
    }
    const serverCache = results.map((r) => r.body.meta.serverCache).sort();
    expect(serverCache.filter((s) => s === 'miss')).toHaveLength(1);
    expect(serverCache.filter((s) => s === 'coalesced-redis')).toHaveLength(2);
    // ONE fan-out (Open-Meteo + MET), not three.
    expect(fetchFn).toHaveBeenCalledTimes(2);
  }, 20000);

  it('control: an unchanged read by three instances is three hits and zero fetches', async () => {
    vi.setSystemTime(new Date('2026-05-19T09:59:00Z'));
    stubProviders(0);
    await call(await instance());
    await new Promise((r) => setTimeout(r, 30));
    vi.setSystemTime(new Date('2026-05-19T09:59:30Z'));
    const fetchFn = stubProviders(60);
    const b = await instance(); const c = await instance(); const d = await instance();
    const results = await Promise.all([call(b), call(c), call(d)]);
    expect(results.map((r) => r.body.meta.serverCache)).toEqual(['hit', 'hit', 'hit']);
    expect(fetchFn).not.toHaveBeenCalled();
  }, 20000);
});

describe('item 3 — within a LOSING instance, concurrent callers still coalesce locally after a refusal', () => {
  it('leader instance fans out once; three concurrent callers on a losing instance → one coalesced-redis + two coalesced-local, no extra fetch', async () => {
    vi.setSystemTime(new Date('2026-05-19T09:59:00Z'));
    stubProviders(0);
    await call(await instance());
    await new Promise((r) => setTimeout(r, 30));
    vi.setSystemTime(new Date('2026-05-19T10:01:00Z'));
    const fetchFn = stubProviders(300); // the leader is slow, so the loser's callers all arrive while it holds the lock
    const leader = await instance();
    const loser = await instance();
    const leaderCall = call(leader);
    await new Promise((r) => setTimeout(r, 50)); // leader has refused the entry and taken the lock
    const loserResults = await Promise.all([call(loser), call(loser), call(loser)]);
    const leaderResult = await leaderCall;
    expect(leaderResult.body.meta.serverCache).toBe('miss');
    const kinds = loserResults.map((r) => r.body.meta.serverCache).sort();
    expect(kinds.filter((k) => k === 'coalesced-redis')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'coalesced-local')).toHaveLength(2);
    for (const r of loserResults) expect(r.body.now.conditionKey).toBe('uv');
    expect(fetchFn).toHaveBeenCalledTimes(2); // Open-Meteo + MET, once
  }, 20000);
});
