// Prelaunch item 7 (P1-5, 2026-09-14): the handler answers with a partial
// forecast well inside the client's 10 s abort (assets/app.js fetchProbable:
// 10000 ms), whatever it had to wait on.
//
// Astra's evidence (recorded, not inferred): a Johannesburg GET answered after
// 10,472 ms with Open-Meteo marked unavailable. The browser's timeout toast
// could not be attributed to that exact request. The INFERRED mechanism —
// the 9 s upstream cap plus serial name resolution plus overhead — is what
// these tests size against; the assertions are about the response time.
//
// Round 2 (Astra): expiring the lock wait used to start another fan-out
// (14.6 s measured), and Redis reads before the fan-out were unbounded
// (4.5 s read + stalled provider = 10.5 s). Now one request budget covers
// every wait, and its expiry is terminal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cacheMod = vi.hoisted(() => ({ original: null }));
vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  cacheMod.original = mod;
  return {
    ...mod,
    weatherCacheGet: vi.fn(mod.weatherCacheGet),
    weatherCacheGetStale: vi.fn(mod.weatherCacheGetStale),
    weatherCacheAcquireLock: vi.fn(mod.weatherCacheAcquireLock),
    waitForWeatherCache: vi.fn(mod.waitForWeatherCache),
    weatherCacheSetDeferred: vi.fn(mod.weatherCacheSetDeferred),
  };
});

// Round 3: a controllable Redis/limiter UNDER the real helpers. `fake.redis`
// null (default) = no Redis, as before; a test installs a fake with a delay to
// exercise the real weatherCacheGet / waitForWeatherCache / lock code paths.
const fake = vi.hoisted(() => ({ redis: null, limiter: null }));
vi.mock('../api/_lib/limiters.js', () => ({
  getRedis: () => fake.redis,
  weatherLimiter: () => fake.limiter,
  weatherDailyLimiter: () => fake.limiter,
  geocodeLimiter: () => null,
  errorsLimiter: () => null,
  ogLimiter: () => null,
  RATE_LIMITS: {},
}));

import handler, {
  NAME_RESOLUTION_TIMEOUT_MS,
  LOCAL_MISS_WAIT_MS,
  REDIS_OP_TIMEOUT_MS,
  REQUEST_BUDGET_MS,
  WEATHER_UPSTREAM_TIMEOUT_MS,
} from '../api/weather.js';
import { consumeProviderBudgets } from '../api/_lib/provider-budget.js';
import {
  WEATHER_LOCK_WAIT_MS,
  WEATHER_REDIS_OP_TIMEOUT_MS,
  waitForWeatherCache,
  weatherCacheAcquireLock,
  weatherCacheGet,
  weatherCacheGetStale,
  weatherCacheSetDeferred,
} from '../api/_lib/weather-cache.js';

const CLIENT_ABORT_MS = 10000; // assets/app.js fetchProbable

const makeResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn(async () => payload),
});

const metPayload = {
  properties: {
    timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 8, 13, 22 + i, 0, 0)).toISOString(),
      data: {
        instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } },
        next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
      },
    })),
  },
};

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
    weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-09-14T06:30'), sunset: Array(7).fill('2026-09-14T18:15'),
  },
};

// A fetch that never answers on its own — it only rejects when the handler's
// AbortController fires, exactly like a stalled upstream socket.
const stalled = (opts) => new Promise((_, reject) => {
  const abort = () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); };
  if (opts?.signal?.aborted) abort();
  else opts?.signal?.addEventListener('abort', abort, { once: true });
});

// A Redis round trip that takes `ms` before yielding `value`.
const slowRedis = (ms, value) => () => new Promise((resolve) => setTimeout(() => resolve(value), ms));

// An in-memory Upstash stand-in whose every command takes `delayMs`. Enough
// surface for the cache (get/set nx/eval), the lock, the budget script and
// the Open-Meteo counter.
// `delayMs` is a number for every command, or a per-command map ({ get, set, … }).
const makeFakeRedis = ({ delayMs = 0, store = new Map() } = {}) => {
  const delayFor = (op) => (typeof delayMs === 'number' ? delayMs : (delayMs[op] ?? 0));
  const later = (op, fn) => new Promise((resolve) => setTimeout(() => resolve(fn()), delayFor(op)));
  const redis = {
    store,
    calls: [],
    get: (key) => { redis.calls.push(['get', key, Date.now()]); return later('get', () => (store.has(key) ? store.get(key) : null)); },
    set: (key, value, opts = {}) => { redis.calls.push(['set', key]); return later('set', () => { if (opts.nx && store.has(key)) return null; store.set(key, value); return 'OK'; }); },
    del: (key) => later('del', () => (store.delete(key) ? 1 : 0)),
    eval: (script, keys) => { redis.calls.push(['eval', keys?.[0], Date.now()]); return later('eval', () => (redis.evalResult ? redis.evalResult(keys) : 1)); },
    incrby: (key, n) => later('incrby', () => { const v = (store.get(key) || 0) + n; store.set(key, v); return v; }),
    expire: () => later('expire', () => 1),
  };
  return redis;
};
// A limiter whose limit() answers after `ms` — the Upstash client's own
// timeout is 5 s, which is what a stalled Redis looks like to checkRateLimit.
const stalledLimiter = (ms) => ({ limit: () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), ms)) });

const callHandler = () => {
  let statusCode = 200;
  let body;
  const headers = {};
  const req = { query: { lat: '-26.2041', lon: '28.0473', name: '' } }; // placeholder name → LocationIQ path
  const res = {
    setHeader: vi.fn((k, v) => { headers[k] = v; }),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  return handler(req, res).then(() => ({ statusCode, body, headers }));
};

// Open-Meteo and LocationIQ stall, MET answers at once.
const stubStalledOpenMeteo = () => {
  const fetchFn = vi.fn(async (url, opts) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return stalled(opts);
    if (href.includes('locationiq.com/')) return stalled(opts);
    if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
    throw new Error(`Unexpected URL: ${href}`);
  });
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
};

// Drive a pending handler call to completion under fake timers and report
// how long it took on the fake clock.
const settle = async (pending, advanceMs) => {
  const started = Date.now();
  let finishedAt = null;
  const tracked = pending.then((r) => { finishedAt = Date.now(); return r; });
  await vi.advanceTimersByTimeAsync(advanceMs);
  const result = await tracked;
  return { ...result, elapsed: finishedAt - started };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-14T06:47:00Z'));
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  process.env.LOCATIONIQ_TOKEN = 'liq-key';
  const o = cacheMod.original;
  weatherCacheGet.mockReset().mockImplementation(o.weatherCacheGet);
  weatherCacheGetStale.mockReset().mockImplementation(o.weatherCacheGetStale);
  weatherCacheAcquireLock.mockReset().mockImplementation(o.weatherCacheAcquireLock);
  waitForWeatherCache.mockReset().mockImplementation(o.waitForWeatherCache);
  weatherCacheSetDeferred.mockReset().mockImplementation(o.weatherCacheSetDeferred);
});

afterEach(() => {
  delete process.env.LOCATIONIQ_TOKEN;
  delete process.env.PW_TEST_REAL_BUDGET;
  fake.redis = null;
  fake.limiter = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('item 7 — one stalled provider never pushes the answer past the client timeout', () => {
  it('Open-Meteo stalls, LocationIQ stalls: partial forecast returns at the upstream cap, well inside 10 s', async () => {
    stubStalledOpenMeteo();
    const started = Date.now();
    const pending = callHandler();
    // Nothing can answer before the cap: the handler must still be waiting.
    let settled = false;
    pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(WEATHER_UPSTREAM_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const { statusCode, body } = await pending;
    const elapsed = Date.now() - started;
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: false });
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.now.tempC).toBe(18);
    expect(elapsed).toBeLessThanOrEqual(WEATHER_UPSTREAM_TIMEOUT_MS + 1);
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 3000); // "well inside": at least 3 s of headroom
  });

  it('budget invariants: every server-side wait fits under the client abort with headroom', () => {
    expect(WEATHER_UPSTREAM_TIMEOUT_MS).toBeLessThanOrEqual(6000);
    expect(NAME_RESOLUTION_TIMEOUT_MS).toBeLessThanOrEqual(WEATHER_UPSTREAM_TIMEOUT_MS);
    // Name resolution runs in PARALLEL with the fan-out, so the leader's worst
    // case is max(name, upstream) + overhead, not their sum.
    expect(Math.max(WEATHER_UPSTREAM_TIMEOUT_MS, NAME_RESOLUTION_TIMEOUT_MS) + 2000).toBeLessThan(CLIENT_ABORT_MS);
    // Round 2: the whole request lives inside ONE budget with headroom under
    // the client abort, and a bounded Redis read plus a full provider cap
    // still fits inside it.
    expect(REQUEST_BUDGET_MS + 1000).toBeLessThan(CLIENT_ABORT_MS);
    expect(REDIS_OP_TIMEOUT_MS + WEATHER_UPSTREAM_TIMEOUT_MS).toBeLessThanOrEqual(REQUEST_BUDGET_MS);
    // A waiter coalescing on another instance's miss must give up in time too.
    expect(LOCAL_MISS_WAIT_MS).toBeLessThanOrEqual(REQUEST_BUDGET_MS);
    expect(WEATHER_LOCK_WAIT_MS).toBeLessThan(CLIENT_ABORT_MS - 1000);
    // …but still outlast a slow-but-successful leader.
    expect(LOCAL_MISS_WAIT_MS).toBeGreaterThan(WEATHER_UPSTREAM_TIMEOUT_MS + 1000);
    expect(WEATHER_LOCK_WAIT_MS).toBeGreaterThan(WEATHER_UPSTREAM_TIMEOUT_MS + 1000);
  });
});

describe('item 7 round 2 — the request budget is one terminal deadline', () => {
  it('a lock loser whose poll expires answers a bounded 503 and never fans out for itself', async () => {
    const fetchFn = stubStalledOpenMeteo();
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValue(null);
    let requestedWait = null;
    waitForWeatherCache.mockImplementation(async (key, redis, { maxWaitMs }) => {
      requestedWait = maxWaitMs;
      await new Promise((resolve) => setTimeout(resolve, maxWaitMs));
      return null; // the leader never published an acceptable entry
    });
    const { statusCode, body, headers, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    // The poll was given the budget LEFT, not a fresh window.
    expect(requestedWait).toBeLessThanOrEqual(REQUEST_BUDGET_MS);
    expect(requestedWait).toBeGreaterThan(0);
    // Expiry is terminal: a bounded, uncacheable 503 — no provider or name
    // lookup was started, so no work lands after the client has gone.
    expect(statusCode).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.degraded).toBe(true);
    expect(body.meta.reason).toBe('coalesce-timeout');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
    expect(elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 400); // + the 300 ms grace read
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
  });

  it('a lock loser whose poll expires serves the last good value when one is acceptable', async () => {
    // First, a real leader run produces a genuine cache entry.
    stubStalledOpenMeteo();
    let written = null;
    weatherCacheSetDeferred.mockImplementation((key, payload) => { written = payload; return true; });
    await settle(callHandler(), CLIENT_ABORT_MS);
    expect(written?.ok).toBe(true);

    // Then a waiter: fresh miss, lock lost, nothing acceptable while polling,
    // but the last good value is there at expiry.
    const fetchFn = stubStalledOpenMeteo();
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValueOnce(null).mockResolvedValue(written);
    waitForWeatherCache.mockImplementation(async (key, redis, { maxWaitMs }) => {
      await new Promise((resolve) => setTimeout(resolve, maxWaitMs));
      return null;
    });
    const { statusCode, body, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.serverCache).toBe('stale-deadline');
    expect(body.now.tempC).toBe(18);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
  });

  it('a 4.5 s Redis read is abandoned at the op cap, so a stalled provider still answers inside 10 s', async () => {
    stubStalledOpenMeteo();
    weatherCacheGet.mockImplementation(slowRedis(4500, null));
    const { statusCode, body, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.serverCache).toBe('miss');
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: false });
    expect(elapsed).toBeLessThanOrEqual(REDIS_OP_TIMEOUT_MS + WEATHER_UPSTREAM_TIMEOUT_MS + 50);
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
  });

  it('Redis time before the fan-out comes off the providers\' cap: the answer lands at the budget, not after it', async () => {
    stubStalledOpenMeteo();
    // Two Redis round trips just under the op cap (2.8 s together) leave the
    // stalled provider 5.7 s, not its full 6 s.
    weatherCacheGet.mockImplementation(slowRedis(1400, null));
    weatherCacheAcquireLock.mockImplementation(slowRedis(1400, { acquired: true, release: async () => {} }));
    const { statusCode, body, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.now.tempC).toBe(18);
    expect(elapsed).toBeGreaterThan(2800 + 5000); // the provider really was given the remainder, not cut short
    expect(elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 50);
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
  });

  it('a local waiter that inherits a failed leader\'s cell retries only inside what is left of its own budget', async () => {
    // Leader: every upstream stalls, so it fails at the 6 s cap and hands its
    // waiters null. The waiter (started 1 s later) then leads for itself —
    // with 3.5 s of budget left, not a fresh 6 s cap — and answers at its own
    // 8.5 s mark, inside the client's abort.
    const fetchFn = vi.fn(async (url, opts) => stalled(opts));
    vi.stubGlobal('fetch', fetchFn);
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheGetStale.mockResolvedValue(null);
    const leader = callHandler();
    await vi.advanceTimersByTimeAsync(1000);
    const w = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    const l = await leader;
    expect(l.statusCode).toBe(503);
    expect(w.statusCode).toBe(503);
    expect(w.body.ok).toBe(false);
    expect(w.elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 50);
    expect(w.elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
    // Exactly one retry fan-out, started only after the leader gave up.
    const omCalls = fetchFn.mock.calls.filter(([u]) => String(u).includes('open-meteo.com/'));
    expect(omCalls).toHaveLength(2);
  }, 20000);
});

describe('item 7 round 3 — the real helpers over a slow Redis, and the gates before the fan-out', () => {
  it('both rate limiters stalling (5 s each, the Upstash default) are bounded: the forecast still lands inside the budget', async () => {
    fake.limiter = stalledLimiter(5000);
    stubStalledOpenMeteo();
    const { statusCode, body, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 10000);
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    // Two bounded gates (≤1.5 s each) + a provider cap trimmed to what is left.
    expect(elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 50);
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
  }, 20000);

  it('the REAL polling helper over a 4 s Redis: a lock loser answers a bounded 503, reads never outlive the budget, no fan-out', async () => {
    // Lock already held by another instance (the lock SET answers fast, with
    // "taken"); every READ takes 4 s — the leader never publishes.
    const redis = makeFakeRedis({ delayMs: { get: 4000, set: 100, eval: 100 } });
    redis.store.set('pw-wx:v2:-26.20,28.04:lock', 'someone-else');
    fake.redis = redis;
    const fetchFn = stubStalledOpenMeteo();
    const { statusCode, body, headers, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 10000);
    expect(statusCode).toBe(503);
    expect(body.meta.reason).toBe('coalesce-timeout');
    expect(body.meta.stage).toBe('redis-wait');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 400);
    expect(elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
    // Several bounded polling reads happened, and none was started after the budget ran out.
    const reads = redis.calls.filter(([op, key]) => op === 'get' && key === 'pw-wx:v2:-26.20,28.04');
    expect(reads.length).toBeGreaterThanOrEqual(3);
  }, 20000);

  it('a slow Redis on the lock SET itself (op cap hit) fails open: this request leads, bounded by what is left', async () => {
    const redis = makeFakeRedis({ delayMs: 4000 });
    fake.redis = redis;
    stubStalledOpenMeteo();
    const { statusCode, body, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 10000);
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 50);
  }, 20000);

  it('the real polling helper bounds each read by the op cap and stops AT its deadline (no read after it)', async () => {
    const redis = makeFakeRedis({ delayMs: 4000 });
    fake.redis = redis;
    const started = Date.now();
    let finishedAt = null;
    const pending = waitForWeatherCache('pw-wx:v2:test', redis, { maxWaitMs: 3000 }).then((r) => { finishedAt = Date.now(); return r; });
    await vi.advanceTimersByTimeAsync(20000);
    expect(await pending).toBeNull();
    expect(finishedAt - started).toBeLessThanOrEqual(3000 + 5);
    // Reads: at 0 (cap 1.5 s), at ~1.7 s (cap 1.3 s), at 3.0 s (cap 1 ms) — none after the deadline.
    const reads = redis.calls.filter(([op]) => op === 'get');
    expect(reads.length).toBeGreaterThanOrEqual(2);
    expect(reads.length).toBeLessThanOrEqual(3);
    expect(WEATHER_REDIS_OP_TIMEOUT_MS).toBeLessThanOrEqual(1500);
  });

  it('a stalled MET is capped like every other provider: Open-Meteo alone answers at the upstream cap', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const href = String(url);
      if (href.startsWith('https://api.met.no/')) return stalled(opts);
      if (href.includes('locationiq.com/')) return stalled(opts);
      if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
    const { statusCode, body, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: true });
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: false });
    expect(elapsed).toBeLessThanOrEqual(WEATHER_UPSTREAM_TIMEOUT_MS + 5);
  });

  it('a stalled MET after 2.8 s of Redis time answers at the budget, not at Redis time + 6 s', async () => {
    weatherCacheGet.mockImplementation(slowRedis(1400, null));
    weatherCacheAcquireLock.mockImplementation(slowRedis(1400, { acquired: true, release: async () => {} }));
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const href = String(url);
      if (href.startsWith('https://api.met.no/')) return stalled(opts);
      if (href.includes('locationiq.com/')) return stalled(opts);
      if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
    const { statusCode, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS + 5000);
    expect(statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 50);
  });

  it('a budget check that times out keeps every provider decision that DID complete (an explicit denial stays a denial)', async () => {
    vi.useRealTimers();
    const redis = {
      eval: (script, keys) => {
        const key = String(keys[0]);
        if (key.includes(':tomorrow:')) return Promise.resolve(0);          // denied at once
        if (key.includes(':met:')) return new Promise((r) => setTimeout(() => r(1), 4500)); // slow
        return Promise.resolve(1);
      },
    };
    const result = await consumeProviderBudgets(['open-meteo', 'met', 'tomorrow'], redis, Date.now(), { timeoutMs: 100 });
    expect(result.tomorrow).toBe(false);          // NOT replaced by "allowed"
    expect(result['open-meteo']).toBe(true);
    expect(typeof result.met).toBe('boolean');    // the timed-out check took the per-instance fallback
  });
});

describe('item 7 round 4 — exhaustion at the budget check, denials through the real path, no read after a deadline', () => {
  const CELL = 'pw-wx:v2:-26.20,28.04';

  it('a waiter that inherits a failed leader with almost nothing left, and spends it on the lock and the budget check, serves the last good value instead of a doomed fan-out', async () => {
    // A genuine entry to serve as the last good value.
    stubStalledOpenMeteo();
    let written = null;
    weatherCacheSetDeferred.mockImplementation((key, payload) => { written = payload; return true; });
    await settle(callHandler(), CLIENT_ABORT_MS);
    expect(written?.ok).toBe(true);
    weatherCacheSetDeferred.mockImplementation(() => true);

    // Real budget path, over a Redis whose reads are quick but whose lock SET
    // and budget EVAL each take 4 s (capped by the op cap / the budget left).
    process.env.PW_TEST_REAL_BUDGET = '1';
    const redis = makeFakeRedis({ delayMs: { get: 100, set: 4000, eval: 4000 } });
    redis.store.set(`${CELL}:stale`, written);
    fake.redis = redis;
    const fetchFn = vi.fn(async (url, opts) => stalled(opts)); // every upstream stalls
    vi.stubGlobal('fetch', fetchFn);

    const leader = callHandler();
    await vi.advanceTimersByTimeAsync(2000);
    const w = await settle(callHandler(), CLIENT_ABORT_MS + 10000);
    const l = await leader;
    expect(l.statusCode).toBe(503); // everything stalled, at its own budget
    // The waiter: 6.5 s on the leader → 1.5 s on the lock → the budget check
    // eats the rest → no providers, the stale forecast instead.
    expect(w.statusCode).toBe(200);
    expect(w.body.meta.serverCache).toBe('stale-deadline');
    expect(w.body.now.tempC).toBe(18);
    expect(w.elapsed).toBeLessThanOrEqual(REQUEST_BUDGET_MS + 400);
    expect(w.elapsed).toBeLessThan(CLIENT_ABORT_MS - 1000);
    const omCalls = fetchFn.mock.calls.filter(([u]) => String(u).includes('open-meteo.com/'));
    expect(omCalls).toHaveLength(1); // the leader's only
  }, 20000);

  it('through the REAL budget path, an explicitly denied provider is never fetched while the others are', async () => {
    process.env.PW_TEST_REAL_BUDGET = '1';
    const redis = makeFakeRedis({ delayMs: 50 });
    redis.evalResult = (keys) => (String(keys?.[0]).includes(':met:') ? 0 : 1);
    fake.redis = redis;
    const fetchFn = vi.fn(async (url, opts) => {
      const href = String(url);
      if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
      if (href.includes('locationiq.com/')) return stalled(opts);
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    });
    vi.stubGlobal('fetch', fetchFn);
    const { statusCode, body } = await settle(callHandler(), CLIENT_ABORT_MS);
    expect(statusCode).toBe(200);
    expect(fetchFn.mock.calls.filter(([u]) => String(u).startsWith('https://api.met.no/'))).toHaveLength(0);
    expect(fetchFn.mock.calls.filter(([u]) => String(u).includes('open-meteo.com/'))).toHaveLength(1);
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: false });
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: true });
  });

  it('a denied provider stays denied when ANOTHER provider\'s check times out (real path, mixed delays)', async () => {
    process.env.PW_TEST_REAL_BUDGET = '1';
    const redis = makeFakeRedis({ delayMs: 0 });
    redis.evalResult = (keys) => (String(keys?.[0]).includes(':met:') ? 0 : 1);
    const slowEval = redis.eval;
    redis.eval = (script, keys) => (String(keys?.[0]).includes(':open-meteo:')
      ? new Promise((resolve) => setTimeout(() => resolve(1), 4000))
      : slowEval(script, keys));
    fake.redis = redis;
    const t0 = Date.now();
    let omStartedAt = null;
    const fetchFn = vi.fn(async (url, opts) => {
      const href = String(url);
      if (href.includes('open-meteo.com/')) { omStartedAt = Date.now(); return makeResponse(openMeteoPayload); }
      if (href.includes('locationiq.com/')) return stalled(opts);
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    });
    vi.stubGlobal('fetch', fetchFn);
    const { statusCode, elapsed } = await settle(callHandler(), CLIENT_ABORT_MS);
    expect(statusCode).toBe(200);
    expect(fetchFn.mock.calls.filter(([u]) => String(u).startsWith('https://api.met.no/'))).toHaveLength(0);
    // The slow check was cut at the op cap: the fan-out started by then. (The
    // response itself waits for the parallel 3 s name lookup, not for Redis.)
    expect(omStartedAt - t0).toBeLessThanOrEqual(REDIS_OP_TIMEOUT_MS + 50);
    expect(elapsed).toBeLessThanOrEqual(Math.max(REDIS_OP_TIMEOUT_MS, NAME_RESOLUTION_TIMEOUT_MS) + 50);
  });

  it('the polling helper starts no read after its deadline, and none at all on a zero budget', async () => {
    const redis = makeFakeRedis({ delayMs: 4000 });
    const t0 = Date.now();
    const zero = waitForWeatherCache('pw-wx:v2:zero', redis, { maxWaitMs: 0 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await zero).toBeNull();
    expect(redis.calls.filter(([op]) => op === 'get')).toHaveLength(0);

    const short = waitForWeatherCache('pw-wx:v2:short', redis, { maxWaitMs: 50 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(await short).toBeNull();
    const reads = redis.calls.filter(([op, key]) => op === 'get' && key === 'pw-wx:v2:short');
    expect(reads).toHaveLength(1);
    expect(reads[0][2] - t0).toBeLessThanOrEqual(100); // started at 0, never at 72 ms
  });
});

describe('item 7 round 4 minor — every polling read starts strictly before the deadline, immediate misses included', () => {
  it('50 ms deadline, instant misses: reads at 0 and every poll tick, none at or after 50 ms', async () => {
    const redis = makeFakeRedis({ delayMs: 0 });
    const t0 = Date.now();
    const pending = waitForWeatherCache('pw-wx:v2:fast', redis, { maxWaitMs: 50, pollMs: 10 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBeNull();
    const reads = redis.calls.filter(([op, key]) => op === 'get' && key === 'pw-wx:v2:fast');
    expect(reads.length).toBeGreaterThanOrEqual(3);
    for (const [, , at] of reads) expect(at - t0).toBeLessThan(50);
  });

  it('a value published during the poll is returned; reads stop at once', async () => {
    const redis = makeFakeRedis({ delayMs: 0 });
    const pending = waitForWeatherCache('pw-wx:v2:late', redis, { maxWaitMs: 2000, pollMs: 100 });
    await vi.advanceTimersByTimeAsync(350);
    redis.store.set('pw-wx:v2:late', { ok: true, marker: 'published' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toEqual({ ok: true, marker: 'published' });
    const reads = redis.calls.filter(([op, key]) => op === 'get' && key === 'pw-wx:v2:late');
    expect(reads.length).toBeLessThanOrEqual(5);
  });
});
