// Prelaunch item 1 (Astra P0-1, 2026-09-14): the shared-IP weather limits.
//
// Round 1: api/weather.js charged a flat 240/IP/minute and 300/IP/day at the
// top of the handler, ahead of the server weather-cache lookup. A cache hit —
// no upstream call, no provider quota spent — still burned allowance, and
// behind SA carrier CGNAT thousands of unrelated users shared those buckets.
// Round 2: a request about to be REFUSED still became the cell's in-flight
// leader and took the Redis lock before admission ran (105 denied callers
// delayed an unrelated IP to 11.4 s); the 1 200/IP/min ceiling rejected a
// legitimate cold burst; ?reverse=1 ate the forecast allowance.
// Round 3: a single charging gate billed requests that were then answered for
// free (coalesced-local, coalesced-redis, stale-lock-wait).
// Round 4: the pre-check was taken once and went stale, so waiters claimed
// leadership on a dead peek and serialised (10.45 s).
// Round 5, fixed here: the 8.5 s budget bounded only one promise-wait, so an
// expired request kept looping and started a SECOND fan-out after fresh data
// was already cached; and per-bucket sequential charges left the earlier
// buckets spent when a later one refused (200 stale-rate-limited, zero upstream
// calls, three charges) — admission is now one atomic Lua EVAL.

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runRedisLua } from './helpers/run-admission-script.js';

// ONE REAL COUNTER STORE, shared by both halves of the gate. Admission is now
// atomic Redis work (api/_lib/admission.js): the peek MGETs the very keys the
// charge INCRs, so the only faithful double is a store, not a pair of booleans.
// This fake implements exactly the two commands admission.js issues, and its
// eval mirrors ADMISSION_SCRIPT including the roll-back — which is what lets
// these tests assert "the refusal spent NOTHING" against actual counter values.
const store = new Map();
const ttls = new Map();
// Every continuation the handler hands to waitUntil (an abandoned admission
// EVAL, and the refund that compensates it). Astra round 9: without this
// registration Vercel may suspend the function before a refund lands.
const keptAlive = [];
let redisLatencyMs = 0; // models the Upstash round trip under fake timers
let peekCalls = 0;
let chargeCalls = 0;
let onPeek = null; // fires AFTER a peek resolves — models another cell racing us
const fakeRedis = {
  async mget(...keys) {
    peekCalls += 1;
    if (redisLatencyMs) await new Promise(r => setTimeout(r, redisLatencyMs));
    const out = keys.map(k => (store.has(k) ? store.get(k) : null));
    if (onPeek) onPeek();
    return out;
  },
  // DELEGATES to the production Lua (fengari), so every admission decision in
  // this file is made by the shipped ADMISSION_SCRIPT rather than by a JS
  // re-implementation of it. tests/admission-script.test.js exercises the
  // script's own edge cases directly.
  async eval(script, keys, args) {
    chargeCalls += 1;
    if (redisLatencyMs) await new Promise(r => setTimeout(r, redisLatencyMs));
    // Dispatch on the script we were handed: a charge and its compensating
    // revert are different Lua, and a double that ran one for the other would
    // hide exactly the leak A3d is here to catch.
    return runRedisLua(script, keys, args, store, ttls);
  },
};

vi.mock('../api/_lib/limiters.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, getRedis: () => fakeRedis };
});

const lockRelease = vi.fn(async () => {});
vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    weatherCacheGet: vi.fn(async () => null),
    weatherCacheGetStale: vi.fn(async () => null),
    waitForWeatherCache: vi.fn(async () => null),
    weatherCacheAcquireLock: vi.fn(async () => ({ acquired: true, release: lockRelease })),
    weatherCacheSetDeferred: vi.fn(() => {}),
  };
});

const budgetAll = (allowed) => Object.fromEntries(
  ['open-meteo', 'weatherapi', 'pirate', 'met', 'tomorrow'].map(p => [p, allowed]),
);
vi.mock('../api/_lib/provider-budget.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, consumeProviderBudgets: vi.fn(async () => ({})) };
});

import handler, { KEEP_ALIVE, PAYLOAD_SCHEMA, deriveCondition } from '../api/weather.js';
import { RATE_LIMITS } from '../api/_lib/limiters.js';
import {
  REFUND_ATTEMPT_TIMEOUT_MS,
  REFUND_BACKOFF_MS,
  REVERSE_ADMISSION,
  REVERT_SCRIPT,
  WEATHER_ADMISSION,
  admissionKeys,
} from '../api/_lib/admission.js';
import { waitForWeatherCache, weatherCacheAcquireLock, weatherCacheGet, weatherCacheGetStale, weatherCacheSetDeferred } from '../api/_lib/weather-cache.js';
import { consumeProviderBudgets } from '../api/_lib/provider-budget.js';

const IP = '41.13.7.99';            // one busy carrier NAT address
const OTHER_IP = '196.4.11.2';      // an unrelated user, elsewhere
const INSTALL = 'f7c1a2b4-9d3e-4a51-8c60-2b7e11d4a903';
const installNo = (n) => `install-${String(n).padStart(6, '0')}`;
// weatherCacheKey snaps to 0.02°, so 0.03° apart guarantees distinct cells.
const cellNo = (n) => ({ lat: '-34.1163', lon: String(18 + n * 0.03) }); // n < 5400 keeps lon in range
const FAR_CELL = { lat: '-25.7479', lon: '28.2293' };

// Counter helpers, expressed against the real key layout so a rename in
// admission.js breaks these tests rather than silently passing them.
const identityOf = (ip, installId) => ({ ip, installId });
const keyFor = (bucket, identity) => admissionKeys([bucket], identity)[0]?.key;
const countOf = (bucket, identity) => Number(store.get(keyFor(bucket, identity))) || 0;
/** Leave exactly `remaining` tokens in a bucket. remaining 0 ⇒ exhausted. */
const leaveRemaining = (bucket, identity, remaining) => {
  store.set(keyFor(bucket, identity), Math.max(0, RATE_LIMITS[bucket].max - remaining));
};
const exhaustAll = (buckets, identity) => { for (const b of buckets) leaveRemaining(b, identity, 0); };
const snapshot = () => JSON.stringify([...store.entries()].sort());
const chargedBuckets = (buckets, identity) => buckets.filter(b => countOf(b, identity) > 0);
// Sum of EVERY admission counter in the store, whatever window bucket it
// belongs to. countOf() reads the CURRENT minute's key, so after a clock
// advance it silently stops seeing a charge left in the original minute —
// round 10's finding. Balance assertions use this instead.
const chargedTotal = () => [...store.entries()]
  .filter(([k]) => k.startsWith('pw-adm:') && !k.startsWith('pw-adm:tok:'))
  .reduce((n, [, v]) => n + (Number(v) || 0), 0);

// Shaped like the entry the miss path actually writes. conditionSignals.selector
// is load-bearing: item 3's cache path re-runs deriveCondition as a DETECTOR and
// refuses any entry it cannot re-check, which would silently turn every "cache
// hit" test below into a fan-out. UV is flat, so no hour boundary can refuse it.
const selectorInputs = {
  desc: 'Clear sky', rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10,
  uvIndex: 1.2, cloudPct: 10, maxWindKph: 10, isDay: true,
  dailyHighC: 24, dailyLowC: 12, sourceDescs: ['Clear sky'],
};
const servableCachedPayload = () => ({
  ok: true,
  location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
  now: {
    tempC: 18, uv: 1.2, isDay: true, conditionKey: 'clear',
    conditionReason: 'clear-default', windKph: 10, cloudPct: 10, feelsLikeC: 18,
    conditionSignals: {
      descWinner: 'Clear sky',
      numeric: { rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10, uvIndex: 1.2, cloudPct: 10, dailyHighC: 24, isDay: true },
      sourceVotes: [{ source: 'Open-Meteo', desc: 'Clear sky', vote: 'clear' }],
      overrides: [],
      selector: { inputs: selectorInputs, base: deriveCondition(selectorInputs) },
    },
  },
  maxWindKph: 10,
  daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear' }],
  hourly: Array.from({ length: 48 }, () => ({ rainChance: 0, uv: 1.2 })),
  meta: {
    localHour: 10, utcOffsetSeconds: 7200, schema: PAYLOAD_SCHEMA,
    updatedAtLabel: '2026-05-19T08:59:00.000Z', sources: [],
  },
});

let clockOrigin = 0;
const callHandler = async ({ headers = { 'x-real-ip': IP, 'x-pw-install': INSTALL }, query = {} } = {}) => {
  let statusCode = 200;
  let body;
  let atMs = null;
  const req = { headers, query: { lat: '-34.1163', lon: '18.8362', name: 'Strand', ...query } };
  const res = {
    setHeader: vi.fn(),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; atMs = Date.now() - clockOrigin; return this; },
  };
  await handler(req, res);
  return { statusCode, body, atMs };
};

// Every provider rejects: the request still reaches the fan-out (which is what
// these tests assert) and comes back as the degraded 503.
const stubFailingFetch = () => {
  const fn = vi.fn(async () => { throw new Error('upstream down'); });
  vi.stubGlobal('fetch', fn);
  return fn;
};
const stubReverseFetch = () => {
  const fn = vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ address: { town: 'Strand', state: 'Western Cape', country_code: 'za' } }),
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
};

// A real (minimal) two-source fan-out, for the tests that need a leader which
// genuinely succeeds and publishes. Same shape as the fixtures in
// tests/uv-cache-refusal-coalescing.test.js.
const omPayload = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
  hourly: {
    temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18),
    precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(12),
    cloud_cover: Array(48).fill(10), relative_humidity_2m: Array(48).fill(50),
    uv_index: Array(48).fill(0.2), weather_code: Array(48).fill(0),
    visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(8),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(8.6),
    weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-05-19T06:00'), sunset: Array(7).fill('2026-05-19T18:00'),
  },
};
const metPayload = {
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
    data: { instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } },
  })) },
};
const providerBody = (href) => (href.includes('open-meteo.com/') ? omPayload
  : href.startsWith('https://api.met.no/') ? metPayload : null);
// A provider that honours the AbortController the handler passes it, exactly
// like a real stalled socket (same shape as `stalled` in
// tests/upstream-timeout-budget.test.js). Without this a fetch double can
// "succeed" after 12 s, which the integrated request budget makes impossible.
const abortable = (ms, opts, onFire) => new Promise((resolve, reject) => {
  let timer;
  const abort = () => {
    clearTimeout(timer);
    const e = new Error('aborted');
    e.name = 'AbortError';
    reject(e);
  };
  if (opts?.signal?.aborted) return abort();
  opts?.signal?.addEventListener('abort', abort, { once: true });
  timer = setTimeout(() => resolve(onFire()), ms);
});

const stubSuccessFetch = ({ delayMs = 0, failUntilMs = 0 } = {}) => {
  // `succeeded` is counted explicitly: vi.fn().mock.results records an ASYNC
  // function's returned promise as type 'return' even when it later rejects,
  // so results cannot distinguish a failed provider call from a good one.
  const fn = vi.fn(async (url) => {
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (failUntilMs && Date.now() - clockOrigin < failUntilMs) throw new Error('upstream down');
    const body = providerBody(String(url));
    if (!body) throw new Error(`Unexpected URL: ${String(url)}`);
    fn.succeeded += 1;
    return { ok: true, status: 200, json: async () => body };
  });
  fn.succeeded = 0;
  vi.stubGlobal('fetch', fn);
  return fn;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z')); // 10:30 SAST
  clockOrigin = Date.now();
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  delete process.env.LOCATIONIQ_TOKEN;
  keptAlive.length = 0;
  KEEP_ALIVE.schedule = (p) => { keptAlive.push(p); };
  store.clear();
  ttls.clear();
  redisLatencyMs = 0;
  peekCalls = 0;
  chargeCalls = 0;
  onPeek = null;
  lockRelease.mockClear();
  weatherCacheAcquireLock.mockReset();
  weatherCacheAcquireLock.mockResolvedValue({ acquired: true, release: lockRelease });
  weatherCacheGetStale.mockReset();
  weatherCacheGetStale.mockResolvedValue(null);
  waitForWeatherCache.mockReset();
  waitForWeatherCache.mockResolvedValue(null);
  weatherCacheGet.mockReset();
  weatherCacheGet.mockResolvedValue(null);
  weatherCacheSetDeferred.mockReset();
  weatherCacheSetDeferred.mockImplementation(() => {});
  consumeProviderBudgets.mockReset();
  consumeProviderBudgets.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ME = identityOf(IP, INSTALL);

describe('item 1 — a cached answer costs no allowance of any kind', () => {
  it('S1 a cache HIT touches NO counter — it neither peeks nor charges', async () => {
    weatherCacheGet.mockResolvedValue(servableCachedPayload());
    const fetchSpy = stubFailingFetch();

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('hit');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(peekCalls).toBe(0);
    expect(chargeCalls).toBe(0);
    expect(store.size).toBe(0);
  });

  it('S2 241 installs behind ONE carrier IP on a warm cache all get 200', async () => {
    weatherCacheGet.mockResolvedValue(servableCachedPayload());

    const statuses = [];
    for (let i = 0; i < 241; i++) {
      const { statusCode } = await callHandler({
        headers: { 'x-real-ip': IP, 'x-pw-install': installNo(i) },
      });
      statuses.push(statusCode);
    }

    expect(statuses.filter(s => s === 200)).toHaveLength(241);
    expect(peekCalls + chargeCalls).toBe(0); // never even consulted
  }, 30000);
});

describe('item 1 — uncached work is metered on IP + install', () => {
  it('S3 a cache MISS charges all four forecast counters, once each', async () => {
    stubFailingFetch();

    const { statusCode } = await callHandler();

    expect(statusCode).toBe(503); // reached the fan-out; every provider failed
    for (const bucket of WEATHER_ADMISSION) expect(countOf(bucket, ME)).toBe(1);
    // The forecast never touches the reverse family.
    expect(chargedBuckets(REVERSE_ADMISSION, ME)).toEqual([]);
  });

  it('S4 a request with no valid install id is governed by the IP ceilings alone', async () => {
    stubFailingFetch();

    for (const headers of [
      { 'x-real-ip': IP },                                     // absent
      { 'x-real-ip': IP, 'x-pw-install': 'short' },             // too short
      { 'x-real-ip': IP, 'x-pw-install': [INSTALL, INSTALL] },  // Vercel array form
    ]) {
      store.clear();
      await callHandler({ headers });
      const anon = identityOf(IP, null);
      expect(countOf('weatherMinuteIp', anon)).toBe(1);
      expect(countOf('weatherDailyIp', anon)).toBe(1);
      // No install id ⇒ no install key exists at all.
      expect(admissionKeys(WEATHER_ADMISSION, anon)).toHaveLength(2);
    }
  });

  it('S5 an exhausted install bucket refuses without spending the shared IP allowance', async () => {
    leaveRemaining('weatherMinuteInstall', ME, 0);
    const before = snapshot();
    const fetchSpy = stubFailingFetch();

    const { statusCode } = await callHandler();

    expect(statusCode).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
    // The gateway's buckets are untouched: one abusive install must not drain
    // the allowance its thousands of NAT neighbours rely on.
    expect(countOf('weatherMinuteIp', ME)).toBe(0);
    expect(countOf('weatherDailyIp', ME)).toBe(0);
    expect(snapshot()).toBe(before); // a refusal at the peek writes nothing
  });

  it('S6 carrier-NAT admission: one gateway right up to the 20 000/day ceiling', async () => {
    stubFailingFetch();
    // 4 999 subscribers x 4 uncached opens have already gone through today.
    store.set(keyFor('weatherDailyIp', ME), 19996);

    const last = identityOf(IP, installNo(5000));
    for (let i = 0; i < 4; i++) {
      const { statusCode } = await callHandler({
        headers: { 'x-real-ip': IP, 'x-pw-install': installNo(5000) },
        query: cellNo(i),
      });
      expect(statusCode).toBe(503); // admitted, then the stubbed providers fail
    }
    expect(countOf('weatherDailyIp', last)).toBe(RATE_LIMITS.weatherDailyIp.max);

    const over = await callHandler({
      headers: { 'x-real-ip': IP, 'x-pw-install': installNo(5001) }, query: cellNo(9),
    });
    expect(over.statusCode).toBe(429);
  }, 20000);

  it('S7 one greedy install is cut off while its NAT neighbours keep going', async () => {
    stubFailingFetch();
    const greedy = identityOf(IP, installNo(1));
    const neighbour = identityOf(IP, installNo(2));
    leaveRemaining('weatherDailyInstall', greedy, 0);
    store.set(keyFor('weatherDailyIp', greedy), 500); // gateway has plenty left

    const greedyRes = await callHandler({ headers: { 'x-real-ip': IP, 'x-pw-install': greedy.installId } });
    expect(greedyRes.statusCode).toBe(429);

    // Same IP, different install: unaffected. Under the old flat per-IP limit
    // this neighbour was a 429 too.
    const neighbourRes = await callHandler({
      headers: { 'x-real-ip': IP, 'x-pw-install': neighbour.installId }, query: cellNo(1),
    });
    expect(neighbourRes.statusCode).toBe(503);
  });
});

describe('item 1 round 5 — admission is atomic, and the deadline is terminal', () => {
  it('A1 a charge refused on the LAST bucket leaves the EARLIER buckets unspent', async () => {
    // Every bucket has room when the peek runs, so the request reaches the
    // charge. The last bucket is then exhausted underneath it. A sequential
    // charge walks the first three, spends them, and only then discovers the
    // fourth is full — leaving three tokens burned for zero upstream calls
    // (Astra's finding). The atomic charge must roll its own increments back.
    for (const b of WEATHER_ADMISSION) leaveRemaining(b, ME, 5);
    let afterRace = null;
    onPeek = () => {
      if (afterRace) return;
      store.set(keyFor('weatherDailyIp', ME), RATE_LIMITS.weatherDailyIp.max); // last bucket, gone
      afterRace = new Map(store);
    };
    const fetchSpy = stubFailingFetch();

    const { statusCode } = await callHandler();

    expect(statusCode).toBe(429); // nothing stale to serve
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(afterRace).not.toBeNull();
    // The three buckets the charge walked BEFORE the refusal are untouched.
    for (const bucket of ['weatherMinuteInstall', 'weatherDailyInstall', 'weatherMinuteIp']) {
      expect(countOf(bucket, ME)).toBe(Number(afterRace.get(keyFor(bucket, ME))) || 0);
    }
  });

  it('A2 the last token taken by another cell BETWEEN peek and charge spends nothing, and stale is served', async () => {
    // One token left everywhere; the peek passes. While that peek is in flight
    // another cell on the same gateway spends the last daily token.
    for (const b of WEATHER_ADMISSION) leaveRemaining(b, ME, 1);
    leaveRemaining('weatherDailyIp', ME, 1);
    let afterRace = null;
    onPeek = () => {
      if (afterRace) return;
      store.set(keyFor('weatherDailyIp', ME), RATE_LIMITS.weatherDailyIp.max); // gone
      afterRace = new Map(store); // the state the refusal must leave untouched
    };
    weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
    const fetchSpy = stubFailingFetch();

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('stale-rate-limited');
    expect(fetchSpy).not.toHaveBeenCalled();
    // The refusal is all-or-nothing: every counter is exactly where the race
    // left it, with no partial spend from the rolled-back charge.
    expect(afterRace).not.toBeNull();
    for (const bucket of WEATHER_ADMISSION) {
      expect(countOf(bucket, ME)).toBe(Number(afterRace.get(keyFor(bucket, ME))) || 0);
    }
  });

  it('A3 Astra\'s reproduction: delayed counters, working locks, failing cache writes — four callers answered by ~8.5 s with at most two fan-outs', async () => {
    // The exact shape of the round-6 finding. Every ingredient is hostile:
    //   · admission counters answer after 100 ms (a real Upstash round trip);
    //   · the distributed lock works, and also costs 100 ms;
    //   · FORECAST CACHE WRITES FAIL — nothing is ever published, so no caller
    //     can be rescued by a cache read, and every pass has to decide on the
    //     coalescing rules alone;
    //   · providers stall for 6 s and fail, then recover and answer in 1.5 s.
    // Before the fix a timed-out waiter evicted the working leader, took
    // leadership itself and started a fresh 8.5 s Redis wait: 19.58 s worst
    // case and four fan-outs where the parent did two.
    redisLatencyMs = 100;
    weatherCacheAcquireLock.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 100));
      return { acquired: true, release: lockRelease };
    });
    // Writes fail: the cache never returns anything, before or after a fan-out.
    weatherCacheSetDeferred.mockImplementation(() => { /* write dropped */ });
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheGetStale.mockResolvedValue(null);

    const fetchSpy = vi.fn(async (url) => {
      const startedAt = Date.now() - clockOrigin;
      if (startedAt < 6000) {
        await new Promise(r => setTimeout(r, 6000)); // the stall, then failure
        throw new Error('upstream down');
      }
      await new Promise(r => setTimeout(r, 1500));   // recovered
      const body = providerBody(String(url));
      if (!body) throw new Error(`Unexpected URL: ${String(url)}`);
      fetchSpy.succeeded += 1;
      return { ok: true, status: 200, json: async () => body };
    });
    fetchSpy.succeeded = 0;
    vi.stubGlobal('fetch', fetchSpy);

    const callers = [0, 1, 2, 3].map(() => callHandler());
    await vi.advanceTimersByTimeAsync(60000);
    const results = await Promise.all(callers);

    // 1. Everyone is answered, and inside the one terminal budget plus the
    //    recovered fan-out — not 19.58 s.
    for (const r of results) {
      expect([200, 503]).toContain(r.statusCode);
      expect(r.atMs).toBeLessThanOrEqual(8600);
    }
    // 2. At most two fan-outs: the stalled one, and the recovered one. Four
    //    callers did NOT produce four.
    const fanOuts = fetchSpy.mock.calls.length / 2; // OM + MET per fan-out
    expect(fanOuts).toBeLessThanOrEqual(2);
    // 3. Expired waiters never replaced leadership: only the requests that
    //    actually led ever took the lock.
    expect(weatherCacheAcquireLock.mock.calls.length).toBeLessThanOrEqual(2);
    // 4. And no request was charged that did not lead.
    expect(countOf('weatherMinuteInstall', ME)).toBeLessThanOrEqual(2);
  }, 60000);

  it('A3c a genuine local-to-Redis handover: lock lost, Redis poll, republished locally', async () => {
    // Astra round 8, point 2: the previous version always refused the lock, so
    // it returned before the charge and could not see finding 1 at all. Here
    // the lock is granted — ownership functions, one holder at a time — so the
    // handover runs all the way to the charge.
    redisLatencyMs = 100;
    const waits = [];
    // The lock holder publishes part-way through the poll, so the waiters are
    // served `coalesced-redis` — a real local-to-Redis handover.
    waitForWeatherCache.mockImplementation(async (key, redis, opts) => {
      waits.push(opts?.maxWaitMs);
      await new Promise(r => setTimeout(r, 1500));
      return servableCachedPayload();
    });
    // The lock is held by ANOTHER INSTANCE for the whole test, so both callers
    // legitimately lose it and must go through the Redis poll — the handover
    // A3c is named for, which a granted lock never exercises.
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: lockRelease });
    weatherCacheGetStale.mockResolvedValue(null);
    weatherCacheGet.mockResolvedValue(null);
    process.env.LOCATIONIQ_TOKEN = 'locationiq-key';
    const fetchSpy = vi.fn((url, opts) => abortable(1500, opts, () => {
      const body = providerBody(String(url));
      if (!body) return { ok: true, status: 200, json: async () => ({ address: { town: 'Strand' } }) };
      fetchSpy.succeeded += 1;
      return { ok: true, status: 200, json: async () => body };
    }));
    fetchSpy.succeeded = 0;
    vi.stubGlobal('fetch', fetchSpy);

    const first = callHandler();
    await vi.advanceTimersByTimeAsync(250);
    const second = callHandler();
    await vi.advanceTimersByTimeAsync(30000);
    const firstResult = await first;
    const secondResult = await second;

    // Both were served from Redis by the instance that held the lock — the
    // handover actually happened, and neither did upstream work.
    expect(firstResult.statusCode).toBe(200);
    // The full chain: caller 1 loses the lock, polls REDIS, and republishes to
    // caller 2 locally. Both halves of the handover, in one request pair.
    expect(firstResult.body.meta.serverCache).toBe('coalesced-redis');
    expect(secondResult.body.meta.serverCache).toBe('coalesced-local');
    expect(fetchSpy.succeeded).toBe(0);
    expect(waits.length).toBeGreaterThan(0);
    // Balances on the ORIGINAL charged keys: a lock loser pays nothing.
    expect(chargedTotal()).toBe(0);
    // Both inside their own budgets.
    expect(firstResult.atMs).toBeLessThanOrEqual(8600);
    expect(secondResult.atMs).toBeLessThanOrEqual(250 + 8600);
  }, 60000);

  it('A3j an SDK REPLAY of a lost charge bills exactly once, end to end', async () => {
    // The Upstash client retries a command whose reply was lost. The EVAL
    // already applied, so without the token the retry would charge a second
    // time. Here the transport rejects AFTER applying, and the client replays
    // the identical command — the counters must move exactly once.
    const realEval = fakeRedis.eval;
    let dropNextReply = true;
    let replays = 0;
    fakeRedis.eval = async (script, keys, args) => {
      const out = await realEval(script, keys, args);   // it APPLIES
      if (dropNextReply && script !== REVERT_SCRIPT) {
        dropNextReply = false;
        // The SDK's own retry of the same command, same token.
        replays += 1;
        await realEval(script, keys, args);
        throw new Error('reply lost');                  // ...and the reply is lost
      }
      return out;
    };
    try {
      weatherCacheGet.mockResolvedValue(null);
      weatherCacheGetStale.mockResolvedValue(null);
      const fetchSpy = stubFailingFetch();

      const result = await callHandler();

      expect(replays).toBe(1);
      expect(result.statusCode).toBe(503); // stubbed providers all fail
      expect(fetchSpy).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(30000);
      // The replay charged nothing extra, and the lost reply left the request
      // unbilled — so the store is back to zero, not at 2.
      expect(chargedTotal()).toBe(0);
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  it('A3k a refund for a charge that never applied leaves other requests\u2019 counters alone', async () => {
    // Populate the counters with other people's legitimate traffic first.
    const realEval = fakeRedis.eval;
    stubFailingFetch();
    for (let i = 0; i < 5; i++) {
      await callHandler({ headers: { 'x-real-ip': IP, 'x-pw-install': installNo(i) }, query: cellNo(i) });
    }
    const populated = chargedTotal();
    expect(populated).toBeGreaterThan(0);

    // Now a request whose charge EVAL rejects WITHOUT having applied.
    let failNext = true;
    fakeRedis.eval = async (script, keys, args) => {
      if (failNext && script !== REVERT_SCRIPT) {
        failNext = false;
        throw new Error('never applied');
      }
      return realEval(script, keys, args);
    };
    try {
      await callHandler({ headers: { 'x-real-ip': IP, 'x-pw-install': installNo(99) }, query: cellNo(99) });
      await vi.advanceTimersByTimeAsync(30000);
      // Its precautionary refund found no token, so it subtracted nothing:
      // everyone else's charges are exactly where they were.
      expect(chargedTotal()).toBe(populated);
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  it('A3f a charge accepted EXACTLY at the deadline is refunded, not billed', async () => {
    // Astra round 9, major 1. The EVAL wins the race against the timeout, so
    // `abandoned` stays false and the old code kept the charge — yet the
    // budget is gone, so the request answers 200 `stale-deadline` with zero
    // upstream calls. The rule is the ABSOLUTE deadline, not who won.
    let evalDelayMs = 0;
    const realEval = fakeRedis.eval;
    // Astra's shape exactly: a 300 ms admission and a TWO-SECOND refund. If the
    // refund is awaited on the response path the answer lands at ~10.5 s, past
    // the client's abort; scheduled, it lands at ~8.5 s and the refund follows.
    fakeRedis.eval = async (script, keys, args) => {
      const delay = script === REVERT_SCRIPT ? 2000 : evalDelayMs;
      if (delay) await new Promise(r => setTimeout(r, delay));
      return realEval(script, keys, args);
    };
    try {
      weatherCacheGet.mockResolvedValue(null);
      weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
      const fetchSpy = stubFailingFetch();
      // 8.2 s gone by the time the lock returns, then a 300 ms EVAL: it
      // completes, admitted, exactly as the budget runs out.
      weatherCacheAcquireLock.mockImplementation(async () => {
        vi.setSystemTime(new Date(Date.now() + 8200));
        evalDelayMs = 300;
        return { acquired: true, release: lockRelease };
      });

      const caller = callHandler();
      await vi.advanceTimersByTimeAsync(30000);
      const result = await caller;

      expect(result.statusCode).toBe(200);
      expect(result.body.meta.serverCache).toBe('stale-deadline');
      expect(fetchSpy).not.toHaveBeenCalled();
      // The refund must be SCHEDULED, not awaited: awaiting a 2 s refund here
      // answered at 10.5 s, past the client's 10 s abort (round 10, major 2).
      expect(result.atMs).toBeLessThanOrEqual(8500 + 400);
      await vi.advanceTimersByTimeAsync(30000);
      expect(chargedTotal()).toBe(0); // no leak in ANY window bucket
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  it('A3g a LOST reply is treated as "may have charged" and reverted', async () => {
    // The EVAL applies and then the connection drops, so the caller sees an
    // error. "It errored" is not "it did nothing": the increments are real.
    const realEval = fakeRedis.eval;
    let lose = false;
    fakeRedis.eval = async (script, keys, args) => {
      const out = realEval(script, keys, args);        // it APPLIES...
      if (lose && script !== REVERT_SCRIPT) {
        lose = false;
        throw new Error('connection reset');           // ...and the reply is lost
      }
      return out;
    };
    try {
      weatherCacheGet.mockResolvedValue(null);
      weatherCacheGetStale.mockResolvedValue(null);
      const fetchSpy = stubFailingFetch();
      lose = true;

      const result = await callHandler();

      // Fail-open: the request went ahead (503 only because the stubbed
      // providers all fail), but it is NOT billed for the lost charge.
      expect(result.statusCode).toBe(503);
      expect(fetchSpy).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(30000);
      expect(chargedTotal()).toBe(0); // no leak in ANY window bucket
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  // Shared setup for the cancellation-recovery cases: a request whose charge
  // lands exactly as the budget runs out, so it answers 200 `stale-deadline`
  // from a stale entry and owes a refund it never earned.
  const expiredRequestOwingARefund = async (onRevert) => {
    const realEval = fakeRedis.eval;
    let evalDelayMs = 0;
    fakeRedis.eval = async (script, keys, args) => {
      if (script === REVERT_SCRIPT) {
        const outcome = await onRevert(Date.now() - clockOrigin);
        if (outcome === 'fail') throw new Error('HTTP 503');
        if (outcome === 'stall') await new Promise(() => {}); // never settles
      }
      if (evalDelayMs && script !== REVERT_SCRIPT) await new Promise(r => setTimeout(r, evalDelayMs));
      return realEval(script, keys, args);
    };
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
    stubFailingFetch();
    weatherCacheAcquireLock.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 8200));
      evalDelayMs = 300; // completes right as the budget runs out
      return { acquired: true, release: lockRelease };
    });
    const caller = callHandler();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await caller;
    return { result, restore: () => { fakeRedis.eval = realEval; } };
  };

  const settleContinuations = async () => {
    await vi.advanceTimersByTimeAsync(60000);
    await Promise.all(keptAlive.map(p2 => Promise.resolve(p2).catch(() => {})));
  };

  it('A3h a 1.5 s HTTP 503 OUTAGE: the cancellation rides it out on the backoff', async () => {
    // Round 13, minor 2: the outage is modelled by TIME, not by counting
    // attempts. Redis 503s for the first 1.5 s after the response, which
    // swallows the attempts at +0 ms, +250 ms and +1 s; the +3 s attempt
    // lands. Retry timing is asserted against REFUND_BACKOFF_MS.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const attemptsAt = [];
    let outageEndsAt = Infinity;
    const { result, restore } = await expiredRequestOwingARefund((atMs) => {
      if (outageEndsAt === Infinity) outageEndsAt = atMs + 1500;
      attemptsAt.push(atMs);
      return atMs < outageEndsAt ? 'fail' : 'ok';
    });
    try {
      expect(result.statusCode).toBe(200);
      expect(result.body.meta.serverCache).toBe('stale-deadline');

      await settleContinuations();

      // THE finding: every ORIGINAL counter key is back to zero.
      expect(chargedTotal()).toBe(0);
      // It reached at least the +3 s attempt, and the gaps follow the schedule.
      expect(attemptsAt.length).toBeGreaterThanOrEqual(4);
      // Each 503 answers immediately, so the gap before attempt i is exactly
      // REFUND_BACKOFF_MS[i] — the schedule, not a coincidence of timing.
      const offsets = attemptsAt.map(t => t - attemptsAt[0]);
      expect(offsets.slice(0, 4)).toEqual([0, 250, 1250, 4250]);
      for (let i = 1; i < 4; i++) {
        expect(offsets[i] - offsets[i - 1]).toBe(REFUND_BACKOFF_MS[i]);
      }
      const tokens = [...store.entries()].filter(([k]) => k.startsWith('pw-adm:tok:'));
      expect(tokens.every(([, v]) => v === 'r' || v === 'c')).toBe(true);
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/refund abandoned/);
    } finally {
      restore();
      warn.mockRestore();
    }
  }, 60000);

  it('A3h3 a STALLED first attempt does not block the next one', async () => {
    // Round 13, major 1. The first EVAL never settles. Without a per-attempt
    // timeout the whole chain hangs behind it: measured at 69.2 s one attempt
    // was still outstanding, the other five had never run, and all four
    // charges survived. The +250 ms attempt must still get its turn.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const attemptsAt = [];
    const { result, restore } = await expiredRequestOwingARefund((atMs) => {
      attemptsAt.push(atMs);
      return attemptsAt.length === 1 ? 'stall' : 'ok';
    });
    try {
      expect(result.statusCode).toBe(200);
      await settleContinuations();

      // The stall was bounded and the second attempt refunded everything.
      expect(attemptsAt.length).toBeGreaterThanOrEqual(2);
      expect(chargedTotal()).toBe(0);
      // Second attempt fires after the first attempt's TIMEOUT plus its own
      // backoff delay — not after the stalled call finally settles (it never
      // does).
      // LITERAL, not derived from the constants: 2 000 ms for the stalled
      // attempt to time out plus the 250 ms schedule gap. Deriving it from
      // REFUND_* would make the assertion agree with whatever value they took.
      expect(attemptsAt[1] - attemptsAt[0]).toBe(2250);
      expect(REFUND_ATTEMPT_TIMEOUT_MS + REFUND_BACKOFF_MS[1]).toBe(2250);
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/refund abandoned/);
    } finally {
      restore();
      warn.mockRestore();
    }
  }, 60000);

  it('A3h2 only when EVERY attempt fails may a charge survive — and it is reported', async () => {
    // The one case where a charge legitimately outlives the request: Redis is
    // down for the whole schedule. It expires with its window, and the
    // abandonment is logged with the token and the keys so it is traceable.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { restore } = await expiredRequestOwingARefund(() => 'fail');
    try {
      await settleContinuations();
      const logged = warn.mock.calls.flat().join(' ');
      expect(logged).toMatch(/\[pw-adm\] refund abandoned for token /);
      expect(logged).toMatch(/keys=pw-adm:weatherMinuteInstall/); // the key list, for tracing
    } finally {
      restore();
      warn.mockRestore();
    }
  }, 60000);

  it('A3i the abandoned charge and its refund are registered with waitUntil', async () => {
    // Lifecycle ownership: both continuations outlive the response, so Vercel
    // must be told to keep the function alive for them.
    let evalDelayMs = 0;
    const realEval = fakeRedis.eval;
    fakeRedis.eval = async (script, keys, args) => {
      if (evalDelayMs) await new Promise(r => setTimeout(r, evalDelayMs));
      return realEval(script, keys, args);
    };
    try {
      weatherCacheGet.mockResolvedValue(null);
      weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
      stubFailingFetch();
      weatherCacheAcquireLock.mockImplementation(async () => {
        vi.setSystemTime(new Date(Date.now() + 8200));
        evalDelayMs = 2000; // the charge is abandoned, then compensates itself
        return { acquired: true, release: lockRelease };
      });

      const before = keptAlive.length;
      const caller = callHandler();
      await vi.advanceTimersByTimeAsync(30000);
      await caller;
      // The charge continuation AND the refund were both handed over.
      expect(keptAlive.length).toBeGreaterThanOrEqual(before + 2);
      await vi.advanceTimersByTimeAsync(30000);
      await Promise.all(keptAlive.map(p => Promise.resolve(p).catch(() => {})));
      expect(chargedTotal()).toBe(0); // no leak in ANY window bucket
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  it('A3d a charge that lands AFTER the budget is compensated: the request is not billed', async () => {
    // Astra round 8, major 1. The budget is nearly gone by the time this
    // request reaches the charge (the lock round trip burned it — the clock
    // jump below stands in for the six-second provider failure and delayed
    // counters in Astra's run). redisOp therefore abandons the EVAL after the
    // few hundred ms that are left — but Redis still runs it, and the
    // increments still land. Measured before the fix: 200 `stale-deadline` at
    // 8.60 s, then all four buckets charged at 9.20 s, no upstream call made.
    let evalDelayMs = 0;
    const realEval = fakeRedis.eval;
    fakeRedis.eval = async (script, keys, args) => {
      if (evalDelayMs) await new Promise(r => setTimeout(r, evalDelayMs));
      return realEval(script, keys, args);
    };
    try {
      weatherCacheGet.mockResolvedValue(null);
      // Something stale exists, so the expired request answers 200 — the leak
      // is invisible in the status code, which is why it survived six rounds.
      weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
      const fetchSpy = stubFailingFetch();
      // Acquiring the lock consumes all but ~300 ms of the request budget.
      weatherCacheAcquireLock.mockImplementation(async () => {
        vi.setSystemTime(new Date(Date.now() + 8200));
        evalDelayMs = 2000; // the charge's EVAL is now far slower than what is left
        return { acquired: true, release: lockRelease };
      });

      const caller = callHandler();
      await vi.advanceTimersByTimeAsync(30000);
      const result = await caller;

      expect(result.statusCode).toBe(200);
      expect(result.body.meta.serverCache).toBe('stale-deadline');
      expect(fetchSpy).not.toHaveBeenCalled(); // no upstream work at all

      // Let the late EVAL and its compensation settle.
      await vi.advanceTimersByTimeAsync(30000);
      // NOT BILLED: every bucket is back where it started.
      expect(chargedTotal()).toBe(0); // no leak in ANY window bucket
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  it('A3e an expired charge starts no LocationIQ lookup and no fan-out', async () => {
    // The placeholder-name variant: the name lookup used to start at 8.50 s,
    // before the old deadline check. With a placeholder name and a token set,
    // an expired request must reach neither LocationIQ nor the providers.
    process.env.LOCATIONIQ_TOKEN = 'locationiq-key';
    let evalDelayMs = 0;
    const realEval = fakeRedis.eval;
    fakeRedis.eval = async (script, keys, args) => {
      if (evalDelayMs) await new Promise(r => setTimeout(r, evalDelayMs));
      return realEval(script, keys, args);
    };
    try {
      weatherCacheGet.mockResolvedValue(null);
      weatherCacheGetStale.mockResolvedValue(null); // nothing to serve → 503
      const fetchSpy = vi.fn(async () => { throw new Error('nothing may be fetched'); });
      vi.stubGlobal('fetch', fetchSpy);
      weatherCacheAcquireLock.mockImplementation(async () => {
        vi.setSystemTime(new Date(Date.now() + 8200));
        evalDelayMs = 2000;
        return { acquired: true, release: lockRelease };
      });

      const caller = callHandler({ query: { name: 'My Location' } }); // placeholder
      await vi.advanceTimersByTimeAsync(30000);
      const result = await caller;

      expect(result.statusCode).toBe(503);
      expect(result.body.meta.reason).toBe('coalesce-timeout');
      // Neither LocationIQ nor a provider was contacted.
      expect(fetchSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(30000);
      expect(chargedTotal()).toBe(0); // no leak in ANY window bucket
    } finally {
      fakeRedis.eval = realEval;
    }
  }, 60000);

  it('A3b a waiter whose budget expires while the leader works returns a bounded degraded 503, not a fan-out', async () => {
    // Nothing stale to fall back on, and a leader that outlasts the waiter's
    // whole budget. The waiter must stand down rather than evict it.
    const fetchSpy = stubSuccessFetch({ delayMs: 60000 });
    weatherCacheGetStale.mockResolvedValue(null);

    const leader = callHandler();
    await vi.advanceTimersByTimeAsync(10);
    const waiter = callHandler();
    await vi.advanceTimersByTimeAsync(9000);

    const waiterResult = await waiter;
    expect(waiterResult.statusCode).toBe(503);
    expect(waiterResult.body).toMatchObject({ ok: false, degraded: true });
    expect(waiterResult.body.meta).toMatchObject({ reason: 'coalesce-timeout', stage: 'local-wait' });
    expect(waiterResult.atMs).toBeLessThanOrEqual(8600);
    // It started no upstream work and took no lock of its own.
    expect(fetchSpy.mock.calls).toHaveLength(2); // the leader's only
    expect(weatherCacheAcquireLock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(120000);
    await leader;
  }, 60000);

  it('A6 a waiter re-reads the cache each pass: data published mid-wait is served, not re-fetched', async () => {
    // The cross-instance case the per-pass re-read exists for. Our leader's
    // fan-out fails, but while we were waiting ANOTHER instance published a
    // good entry to the shared cache. The waiter's next pass must read that
    // and serve it — not peek, claim and fan out on top of fresh data.
    let cached = null;
    weatherCacheGet.mockImplementation(async () => cached);
    const fetchSpy = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 3000));
      throw new Error('upstream down');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const leader = callHandler();
    await vi.advanceTimersByTimeAsync(10);
    const waiter = callHandler();
    // Another instance finishes and publishes while both are still in flight.
    await vi.advanceTimersByTimeAsync(1000);
    cached = servableCachedPayload();

    await vi.advanceTimersByTimeAsync(20000);
    const leaderResult = await leader;
    const waiterResult = await waiter;

    expect(leaderResult.statusCode).toBe(503); // its own providers failed
    expect(waiterResult.statusCode).toBe(200);
    expect(waiterResult.body.meta.serverCache).toBe('hit');
    // Only the leader ever called upstream: OM + MET, once.
    expect(fetchSpy.mock.calls).toHaveLength(2);
  }, 30000);

  it('A4 past the deadline a waiter serves stale rather than starting a second fan-out', async () => {
    // A leader that never finishes: the waiter's 8.5 s budget runs out.
    const fetchSpy = stubSuccessFetch({ delayMs: 60000 });
    weatherCacheGetStale.mockResolvedValue(servableCachedPayload());

    const leader = callHandler();
    await vi.advanceTimersByTimeAsync(10);
    const waiter = callHandler();
    await vi.advanceTimersByTimeAsync(9000);

    const waiterResult = await waiter;
    expect(waiterResult.statusCode).toBe(200);
    expect(waiterResult.body.meta.serverCache).toBe('stale-deadline');
    // The waiter did NOT start its own fan-out: only the leader's two calls.
    expect(fetchSpy.mock.calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(120000);
    await leader;
  }, 30000);

  it('A5 an ACTIVE leader is not pre-empted, and its providers honour the budget', async () => {
    // The leader is never evicted mid-fan-out — but it is not immortal either:
    // its providers are abort-aware, so a fan-out that outruns the request
    // budget ends as a degraded answer, not a 12 s success. (Round 7 wired the
    // provider cap to min(6 s, timeLeft()); this asserts the two agree.)
    const fetchSpy = vi.fn((url, opts) => abortable(12000, opts, () => {
      const body = providerBody(String(url));
      if (!body) throw new Error(`Unexpected URL: ${String(url)}`);
      fetchSpy.succeeded += 1;
      return { ok: true, status: 200, json: async () => body };
    }));
    fetchSpy.succeeded = 0;
    vi.stubGlobal('fetch', fetchSpy);

    const leader = callHandler();
    await vi.advanceTimersByTimeAsync(30000);
    const result = await leader;

    // It kept leadership for its whole fan-out: one attempt, never restarted.
    expect(fetchSpy.mock.calls).toHaveLength(2);
    expect(fetchSpy.succeeded).toBe(0);      // aborted, not completed
    expect(result.statusCode).toBe(503);     // degraded, inside the budget
    expect(result.atMs).toBeLessThanOrEqual(8600);
    expect(countOf('weatherMinuteInstall', ME)).toBe(1); // charged exactly once
  }, 30000);
});

describe('item 1 round 4 — the pre-check is re-taken on every pass at leadership', () => {
  it('R7 a token consumed elsewhere mid-flight refuses 105 callers without any of them leading', async () => {
    const GATE_IP = '105.22.9.4';
    const LOCK_MS = 200;      // so "peeked but not yet charged" is a real window
    const PROVIDER_MS = 1500;

    const gateAnon = identityOf(GATE_IP, null);
    store.set(keyFor('weatherMinuteIp', gateAnon), RATE_LIMITS.weatherMinuteIp.max - 1); // LAST token

    weatherCacheAcquireLock.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, LOCK_MS));
      return { acquired: true, release: lockRelease };
    });
    const fetchSpy = stubSuccessFetch({ delayMs: PROVIDER_MS });

    const flood = Array.from({ length: 105 }, (_, i) => callHandler({
      headers: { 'x-real-ip': GATE_IP, 'x-pw-install': installNo(i) },
    }));
    const unrelated = callHandler({ headers: { 'x-real-ip': OTHER_IP, 'x-pw-install': INSTALL } });

    // Let the peeks land, then let ANOTHER CELL spend the gateway's last token
    // while the first leader is still inside the lock.
    await vi.advanceTimersByTimeAsync(100);
    store.set(keyFor('weatherMinuteIp', gateAnon), RATE_LIMITS.weatherMinuteIp.max);

    await vi.advanceTimersByTimeAsync(30000);
    const floodResults = await Promise.all(flood);
    const unrelatedResult = await unrelated;

    // At most two requests ever took leadership: the one already inside the
    // lock when the token vanished, and the unrelated caller.
    expect(weatherCacheAcquireLock.mock.calls.length).toBeLessThanOrEqual(2);
    expect(floodResults.filter(r => r.statusCode === 429).length).toBeGreaterThan(100);
    // The unrelated user is not queued behind 105 refusals (finding: 10 450 ms).
    expect(unrelatedResult.statusCode).toBe(200);
    expect(unrelatedResult.atMs).toBeLessThan(4000);
    expect(fetchSpy).toHaveBeenCalled();
  }, 60000);
});

describe('item 1 round 3 — only the request that actually calls upstream pays', () => {
  it('R1 a lock loser served `stale-lock-wait` is charged nothing', async () => {
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: lockRelease });
    weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
    const fetchSpy = stubFailingFetch();

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('stale-lock-wait');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chargeCalls).toBe(0);       // someone else is doing the work
    expect(peekCalls).toBeGreaterThan(0); // pre-checked, not charged
  });

  it('R2 a lock loser served `coalesced-redis` is charged nothing', async () => {
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: lockRelease });
    waitForWeatherCache.mockResolvedValue(servableCachedPayload());
    const fetchSpy = stubFailingFetch();

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('coalesced-redis');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chargeCalls).toBe(0);
  });

  it('R3 31 simultaneous same-install requests for one cell: ONE charge, 30 free, no 429', async () => {
    const fetchSpy = stubSuccessFetch();

    const results = await Promise.all(Array.from({ length: 31 }, () => callHandler()));

    expect(results.filter(r => r.statusCode === 429)).toHaveLength(0);
    expect(results.filter(r => r.statusCode === 200)).toHaveLength(31);
    // Exactly one leader went upstream, so exactly one slot is spent in each
    // bucket. Previously all 31 were charged and the 31st was refused by its
    // own 30/min install bucket.
    for (const bucket of WEATHER_ADMISSION) expect(countOf(bucket, ME)).toBe(1);
    expect(results.filter(r => r.body?.meta?.serverCache === 'coalesced-local')).toHaveLength(30);
    expect(fetchSpy.mock.calls).toHaveLength(2); // one fan-out: OM + MET
  }, 20000);

  it('R4 an exhausted allowance still serves an acceptable stale entry instead of 429', async () => {
    exhaustAll(WEATHER_ADMISSION, ME);
    weatherCacheGetStale.mockResolvedValue(servableCachedPayload());
    const fetchSpy = stubFailingFetch();

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('stale-rate-limited');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chargeCalls).toBe(0);
    expect(weatherCacheAcquireLock).not.toHaveBeenCalled(); // took nothing shared
  });

  it('R5 the pre-check refuses BEFORE leadership: no charge, no lock, no record left behind', async () => {
    exhaustAll(WEATHER_ADMISSION, ME);
    const fetchSpy = stubFailingFetch();

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(429); // nothing stale to fall back on
    expect(body).toEqual({ ok: false, error: 'Too many requests' });
    expect(chargeCalls).toBe(0);  // a peek costs nothing
    expect(weatherCacheAcquireLock).not.toHaveBeenCalled();
    expect(lockRelease).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    // No record left behind: with allowance restored the next caller runs
    // straight through. Under fake timers a stale record would park it on the
    // 8.5 s waiter and it would never come back.
    for (const b of WEATHER_ADMISSION) leaveRemaining(b, ME, 5);
    const next = await callHandler();
    expect(next.statusCode).toBe(503);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('R6 a charge refused at the fan-out (pre-check/charge race) 429s, releases the lock, frees waiters', async () => {
    // Allowance present at peek time, gone by charge time — for the leader only.
    for (const b of WEATHER_ADMISSION) leaveRemaining(b, ME, 1);
    let raced = false;
    onPeek = () => {
      if (raced) return;
      raced = true;
      store.set(keyFor('weatherMinuteInstall', ME), RATE_LIMITS.weatherMinuteInstall.max);
    };
    const fetchSpy = stubFailingFetch();

    const first = await callHandler();

    expect(first.statusCode).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
    // The loser of the race held the lock; the finally block gave it back.
    expect(weatherCacheAcquireLock).toHaveBeenCalled();
    expect(lockRelease).toHaveBeenCalled();

    // A later caller, with allowance restored, proceeds immediately.
    onPeek = null;
    for (const b of WEATHER_ADMISSION) leaveRemaining(b, ME, 5);
    const second = await callHandler();
    expect(second.statusCode).toBe(503);
  });
});

describe('item 1 round 2 — a denied request holds nothing (no record, no lock)', () => {
  it('N2 a concurrent cold burst of 5 000 installs on one gateway is fully admitted', async () => {
    const fetchSpy = stubFailingFetch();

    // 5 000 distinct installs, each on its own cold cell, all inside the same
    // minute window — the documented burst profile. The old 1 200/min ceiling
    // 429'd these. Driven in concurrent batches rather than 5 000 simultaneous
    // promises: the assertion is about the per-minute CEILING, not about how
    // many handlers the event loop holds at once, and parking 5 000 timer-
    // coupled promises made this test flaky under a loaded full-suite run.
    const results = [];
    for (let start = 0; start < 5000; start += 250) {
      const batch = Array.from({ length: 250 }, (_, k) => callHandler({
        headers: { 'x-real-ip': IP, 'x-pw-install': installNo(start + k) },
        query: cellNo(start + k),
      }));
      results.push(...await Promise.all(batch));
    }
    const legitResult = await callHandler({
      headers: { 'x-real-ip': OTHER_IP, 'x-pw-install': INSTALL },
      query: FAR_CELL,
    });

    expect(results.filter(r => r.statusCode === 429)).toHaveLength(0);
    expect(results.every(r => r.statusCode === 503)).toBe(true); // all admitted
    expect(countOf('weatherMinuteIp', identityOf(IP, installNo(0)))).toBe(5000);
    expect(legitResult.statusCode).toBe(503);
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
  }, 120000);

  it('N3 5 000 reverse lookups on one gateway are admitted and spend no forecast allowance', async () => {
    process.env.LOCATIONIQ_TOKEN = 'locationiq-key';
    stubReverseFetch();

    const results = await Promise.all(Array.from({ length: 5000 }, (_, i) => callHandler({
      headers: { 'x-real-ip': IP, 'x-pw-install': installNo(i) },
      query: { reverse: '1' },
    })));

    expect(results.filter(r => r.statusCode === 429)).toHaveLength(0);
    expect(results.every(r => r.statusCode === 200)).toBe(true);
    expect(countOf('reverseMinuteIp', identityOf(IP, installNo(0)))).toBe(5000);
    // The point of the separate family: the forecast allowance those same
    // 5 000 users are about to need is untouched.
    expect(chargedBuckets(WEATHER_ADMISSION, ME)).toEqual([]);
  }, 120000);
});

describe('item 1 — the ?reverse=1 geocode path is metered on its own buckets', () => {
  const reverseQuery = { reverse: '1' };

  it('S8 a reverse lookup charges the four REVERSE counters before calling LocationIQ', async () => {
    process.env.LOCATIONIQ_TOKEN = 'locationiq-key';
    const fetchSpy = stubReverseFetch();

    const { statusCode, body } = await callHandler({ query: reverseQuery });

    expect(statusCode).toBe(200);
    expect(body.city).toBe('Strand');
    expect(fetchSpy).toHaveBeenCalled();
    for (const bucket of REVERSE_ADMISSION) expect(countOf(bucket, ME)).toBe(1);
    expect(chargedBuckets(WEATHER_ADMISSION, ME)).toEqual([]);
  });

  it('S9 a reverse lookup over allowance is 429 and never reaches LocationIQ', async () => {
    process.env.LOCATIONIQ_TOKEN = 'locationiq-key';
    leaveRemaining('reverseDailyInstall', ME, 0);
    const fetchSpy = stubReverseFetch();

    const { statusCode, body } = await callHandler({ query: reverseQuery });

    expect(statusCode).toBe(429);
    expect(body).toEqual({ ok: false, error: 'Too many requests' });
    // LocationIQ has no provider budget behind it — this gate is the only
    // thing protecting the geocoding quota from a scripted caller.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('S10 an exhausted forecast allowance does not block a position fix', async () => {
    process.env.LOCATIONIQ_TOKEN = 'locationiq-key';
    exhaustAll(WEATHER_ADMISSION, ME);
    stubReverseFetch();

    const { statusCode } = await callHandler({ query: reverseQuery });
    expect(statusCode).toBe(200);
  });
});

describe('item 1 — accounting model and failure modes', () => {
  it('S11 attempted-work accounting: a budget-denied request is still charged, and says so', async () => {
    consumeProviderBudgets.mockResolvedValue(budgetAll(false));
    const fetchSpy = stubFailingFetch();

    const { statusCode } = await callHandler();

    expect(statusCode).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();  // every provider over budget
    for (const bucket of WEATHER_ADMISSION) expect(countOf(bucket, ME)).toBe(1);
    const limiters = readFileSync(new URL('../api/_lib/limiters.js', import.meta.url), 'utf8');
    expect(limiters).toMatch(/ATTEMPTED WORK, NOT COMPLETED WORK/);
  });

  it('S12 an exhausted caller 429s holding nothing, and leaves the cell usable', async () => {
    exhaustAll(WEATHER_ADMISSION, ME);
    const fetchSpy = stubFailingFetch();

    const [first, second] = await Promise.all([callHandler(), callHandler()]);

    expect(first.statusCode).toBe(429);
    expect(second.statusCode).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(weatherCacheAcquireLock).not.toHaveBeenCalled();
    expect(lockRelease).not.toHaveBeenCalled();
    expect(chargeCalls).toBe(0);

    for (const b of WEATHER_ADMISSION) leaveRemaining(b, ME, 7);
    const third = await callHandler();
    expect(third.statusCode).toBe(503);
    expect(fetchSpy).toHaveBeenCalled();
    expect(weatherCacheAcquireLock).toHaveBeenCalledTimes(1);
  });

  it('S13 fail-open survives: no Redis, and a Redis that throws, both admit', async () => {
    const { peekAdmission, chargeAdmission } = await import('../api/_lib/admission.js');
    await expect(peekAdmission(WEATHER_ADMISSION, ME, null)).resolves.toBe(true);
    // Fail-open admits but is explicitly UNBILLED — nothing was bought, so
    // there is nothing to refund and nothing to leak (round 10, major 1).
    await expect(chargeAdmission(WEATHER_ADMISSION, ME, null))
      .resolves.toMatchObject({ allowed: true, billed: false });
    const throwing = {
      async mget() { throw new Error('upstash down'); },
      async eval() { throw new Error('upstash down'); },
    };
    await expect(peekAdmission(WEATHER_ADMISSION, ME, throwing)).resolves.toBe(true);
    await expect(chargeAdmission(WEATHER_ADMISSION, ME, throwing))
      .resolves.toMatchObject({ allowed: true, billed: false });
  });

  it('S14 an invalid coordinate is still refused, without consulting any counter', async () => {
    const fetchSpy = stubFailingFetch();
    const { statusCode, body } = await callHandler({ query: { lat: 'bad', lon: 'bad' } });
    expect(statusCode).toBe(400);
    expect(body).toEqual({ ok: false, error: 'Invalid lat/lon' });
    expect(peekCalls + chargeCalls).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(weatherCacheGet).not.toHaveBeenCalled();
  });
});

describe('item 1 — the documented numbers and the admission script', () => {
  it('S15 30/min and 300/day per install; 6 000/min and 20 000/day per IP; reverse mirrored', () => {
    expect(RATE_LIMITS.weatherMinuteInstall).toEqual({ max: 30, window: '60 s' });
    expect(RATE_LIMITS.weatherDailyInstall).toEqual({ max: 300, window: '1 d' });
    expect(RATE_LIMITS.weatherMinuteIp).toEqual({ max: 6000, window: '60 s' });
    expect(RATE_LIMITS.weatherDailyIp).toEqual({ max: 20000, window: '1 d' });
    expect(RATE_LIMITS.reverseMinuteInstall).toEqual(RATE_LIMITS.weatherMinuteInstall);
    expect(RATE_LIMITS.reverseDailyInstall).toEqual(RATE_LIMITS.weatherDailyInstall);
    expect(RATE_LIMITS.reverseMinuteIp).toEqual(RATE_LIMITS.weatherMinuteIp);
    expect(RATE_LIMITS.reverseDailyIp).toEqual(RATE_LIMITS.weatherDailyIp);

    expect(RATE_LIMITS.weatherMinuteIp.max).toBeGreaterThan(5000); // the burst profile
    expect(RATE_LIMITS.weatherDailyIp.max).toBeGreaterThan(RATE_LIMITS.weatherDailyInstall.max * 10);
    // Untouched by this item, and still @upstash/ratelimit sliding windows.
    expect(RATE_LIMITS.geocode).toEqual({ max: 240, window: '60 s' });
    expect(RATE_LIMITS.errors).toEqual({ max: 30, window: '60 s' });
    expect(RATE_LIMITS.og).toEqual({ max: 60, window: '60 s' });
    expect(RATE_LIMITS.weather).toBeUndefined();
    expect(RATE_LIMITS.weatherDaily).toBeUndefined();
  });

  it('S16 the burst profile and the fixed-window trade-off are written where the numbers live', () => {
    const limiters = readFileSync(new URL('../api/_lib/limiters.js', import.meta.url), 'utf8');
    expect(limiters).toMatch(/BURST PROFILE/);
    expect(limiters).toMatch(/5 000 users behind one carrier gateway may open/);
    expect(limiters).toMatch(/carrier-grade NAT|CGNAT/);
    expect(limiters).toMatch(/provider-budget\.js/);
    expect(limiters).toMatch(/FIXED windows/);
  });

  it('S17 admission keys carry the bucket, the identity and the window', () => {
    const [minuteInstallKey] = admissionKeys(['weatherMinuteInstall'], ME);
    expect(minuteInstallKey.key).toMatch(/^pw-adm:weatherMinuteInstall:41\.13\.7\.99:f7c1a2b4[^:]*:\d+$/);
    expect(minuteInstallKey.ceiling).toBe(30);
    const [ipDayKey] = admissionKeys(['weatherDailyIp'], ME);
    expect(ipDayKey.key).toMatch(/^pw-adm:weatherDailyIp:41\.13\.7\.99:\d+$/);
    // Minute and day buckets roll on different clocks.
    const later = admissionKeys(['weatherMinuteIp'], ME, Date.now() + 61_000)[0];
    expect(later.key).not.toBe(admissionKeys(['weatherMinuteIp'], ME)[0].key);
    const sameDay = admissionKeys(['weatherDailyIp'], ME, Date.now() + 61_000)[0];
    expect(sameDay.key).toBe(ipDayKey.key);
  });
});

describe('item 1 — the client sends X-PW-Install on every /api/weather call', () => {
  const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it('S18 every /api/weather fetch carries installHeaders()', () => {
    const fetchProbable = js.slice(js.indexOf('async function fetchProbable('));
    expect(fetchProbable.slice(0, fetchProbable.indexOf('\n  }'))).toContain('headers: installHeaders()');

    const inline = js.match(/fetch\(`\/api\/weather[^`]*`[^)]*\)/g) || [];
    expect(inline.length).toBe(3);
    for (const call of inline) expect(call).toContain('installHeaders()');

    expect(js).toContain("return { 'X-PW-Install': installId() };");
  });

  it('S19 installId() mints once, persists under pw_install, and reuses it', () => {
    const start = js.indexOf('function installId(');
    expect(start, 'installId missing from app.js').toBeGreaterThan(-1);
    const src = js.slice(start, js.indexOf('\n  }', start) + 4);
    const make = (localStorage, crypto) => new Function('localStorage', 'crypto', `${src}; return installId;`)(localStorage, crypto);

    const kv = new Map();
    const ls = { getItem: (k) => (kv.has(k) ? kv.get(k) : null), setItem: (k, v) => kv.set(k, v) };

    const first = make(ls, { randomUUID: () => INSTALL })();
    expect(first).toBe(INSTALL);
    expect(kv.get('pw_install')).toBe(INSTALL);
    expect(make(ls, { randomUUID: () => 'a-different-uuid-0000' })()).toBe(INSTALL);
    expect(/^[A-Za-z0-9-]{8,64}$/.test(first)).toBe(true);
  });

  it('S20 without crypto.randomUUID it falls back to a 16-hex id; storage failure never throws', () => {
    const start = js.indexOf('function installId(');
    const src = js.slice(start, js.indexOf('\n  }', start) + 4);
    const make = (localStorage, crypto) => new Function('localStorage', 'crypto', `${src}; return installId;`)(localStorage, crypto);

    const kv = new Map();
    const ls = { getItem: (k) => (kv.has(k) ? kv.get(k) : null), setItem: (k, v) => kv.set(k, v) };
    expect(make(ls, {})()).toMatch(/^[0-9a-f]{16}$/);

    const hostile = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(make(hostile, { randomUUID: () => INSTALL })()).toBe(INSTALL);

    const junk = new Map([['pw_install', 'nope']]);
    const junkLs = { getItem: (k) => (junk.has(k) ? junk.get(k) : null), setItem: (k, v) => junk.set(k, v) };
    expect(make(junkLs, { randomUUID: () => INSTALL })()).toBe(INSTALL);
  });
});
