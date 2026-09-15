// Prelaunch item 1, round 14: the HANDLER must start cancellation the moment
// it gives up waiting for admission — not when the admission reply arrives.
//
// The distinction is the whole finding. Hanging cancellation off the charge
// promise reads correctly and passes every test that lets the reply eventually
// land. But a reply that never lands is exactly the case compensation exists
// for: measured, a request answered 200 `stale-deadline` at 8.5 s with zero
// upstream calls, made ZERO refund attempts, and still had all four counters
// charged at 69.2 s. The token is minted before the EVAL is sent, so cancelling
// needs nothing from the reply — it can and must run in parallel.
//
// This drives the real handler with the installed @upstash/redis client over a
// mocked transport: the admission command is APPLIED to the store (through the
// production Lua, under fengari) and then its reply is simply never returned.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Redis } from '@upstash/redis';

const UPSTASH_URL = 'https://stub.upstash.io';
let redisClient;

vi.mock('../api/_lib/limiters.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, getRedis: () => redisClient };
});

const lockRelease = vi.fn(async () => {});
const cacheMod = vi.hoisted(() => ({ original: null }));
vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  cacheMod.original = mod;
  return {
    ...mod,
    weatherCacheGet: vi.fn(async () => null),
    weatherCacheGetStale: vi.fn(async () => null),
    waitForWeatherCache: vi.fn(async () => null),
    weatherCacheAcquireLock: vi.fn(async () => ({ acquired: true, release: lockRelease })),
    weatherCacheSetDeferred: vi.fn(() => {}),
  };
});
vi.mock('../api/_lib/provider-budget.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, consumeProviderBudgets: vi.fn(async () => ({})) };
});

import handler, { KEEP_ALIVE, PAYLOAD_SCHEMA, deriveCondition } from '../api/weather.js';
import { REFUND_BACKOFF_MS } from '../api/_lib/admission.js';
import { weatherCacheAcquireLock, weatherCacheGet, weatherCacheGetStale } from '../api/_lib/weather-cache.js';
import { runRedisLua } from './helpers/run-admission-script.js';

const IP = '41.13.7.99';
const INSTALL = 'f7c1a2b4-9d3e-4a51-8c60-2b7e11d4a903';

const isAdmission = (cmd) => String(cmd[1]).includes('local undo');
const isRevertCmd = (cmd) => String(cmd[1]).includes('reverted');

// Enough of the Redis command surface for the admission scripts AND the real
// lock helpers (SET NX EX / GET / DEL / EVAL) to run against one store.
const runCommand = (cmd) => {
  const name = String(cmd[0]).toLowerCase();
  const key = cmd[1];
  if (name === 'mget') return cmd.slice(1).map(k => (store.has(k) ? String(store.get(k)) : null));
  if (name === 'get') return store.has(key) ? String(store.get(key)) : null;
  if (name === 'del') { const had = store.delete(key); return had ? 1 : 0; }
  if (name === 'set') {
    const flags = cmd.slice(3).map(o => String(o).toLowerCase());
    if (flags.includes('nx') && store.has(key)) return null;
    const ex = flags.indexOf('ex');
    if (ex >= 0) ttls.set(key, Number(cmd.slice(3)[ex + 1]));
    store.set(key, cmd[2]);
    return 'OK';
  }
  if (name === 'eval') {
    const [, script, numkeys, ...rest] = cmd;
    return runRedisLua(script, rest.slice(0, numkeys), rest.slice(numkeys), store, ttls);
  }
  throw new Error(`unexpected command ${name}`);
};
const isRevert = (cmd) => String(cmd[1]).includes('reverted');

let store;
let ttls;
let keptAlive;
let clockOrigin;
let revertSeenAtMs;
let admissionSeenAtMs;

const selectorInputs = {
  desc: 'Clear sky', rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10,
  uvIndex: 1.2, cloudPct: 10, maxWindKph: 10, isDay: true,
  dailyHighC: 24, dailyLowC: 12, sourceDescs: ['Clear sky'],
};
const stalePayload = () => ({
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

const callHandler = async () => {
  let statusCode = 200;
  let body;
  let atMs = null;
  const req = {
    headers: { 'x-real-ip': IP, 'x-pw-install': INSTALL },
    query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' },
  };
  const res = {
    setHeader: vi.fn(),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; atMs = Date.now() - clockOrigin; return this; },
  };
  await handler(req, res);
  return { statusCode, body, atMs };
};

const counterKeys = () => [...store.keys()].filter(k => k.startsWith('pw-adm:') && !k.startsWith('pw-adm:tok:'));
const counterTotal = () => counterKeys().reduce((n, k) => n + (Number(store.get(k)) || 0), 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
  clockOrigin = Date.now();
  store = new Map();
  ttls = new Map();
  keptAlive = [];
  revertSeenAtMs = null;
  admissionSeenAtMs = null;
  KEEP_ALIVE.schedule = (p) => { keptAlive.push(p); };
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  delete process.env.LOCATIONIQ_TOKEN;
  redisClient = new Redis({ url: UPSTASH_URL, token: 'stub' });
  weatherCacheGet.mockResolvedValue(null);
  weatherCacheGetStale.mockResolvedValue(stalePayload());
  weatherCacheAcquireLock.mockImplementation(async () => {
    // Burn all but ~300 ms of the request budget, so the charge lands at the
    // deadline — the shape the finding was measured in.
    vi.setSystemTime(new Date(Date.now() + 8200));
    return { acquired: true, release: lockRelease };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the handler cancels a stalled admission without waiting for its reply', () => {
  it('H1 admission applies but never replies: stale answer in budget, cancellation fires at once, counters end at zero', async () => {
    vi.stubGlobal('fetch', async (url, opts) => {
      const href = String(url);
      // Providers must never be called on this path.
      if (!href.startsWith(UPSTASH_URL)) throw new Error(`no upstream expected: ${href}`);

      const parsed = JSON.parse(opts.body);
      const batched = Array.isArray(parsed[0]);
      const commands = batched ? parsed : [parsed];
      const results = commands.map((cmd) => {
        const name = String(cmd[0]).toLowerCase();
        // The peek is an MGET, not an EVAL. Running it through the Lua
        // interpreter made it fail, which sent the SDK into a retry loop and
        // pushed the response past the budget — dispatch on the command.
        if (name === 'mget') {
          return { result: cmd.slice(1).map(k => (store.has(k) ? String(store.get(k)) : null)) };
        }
        if (name !== 'eval') throw new Error(`unexpected command ${name}`);
        const [, script, numkeys, ...rest] = cmd;
        const keys = rest.slice(0, numkeys);
        const args = rest.slice(numkeys);
        if (isAdmission(cmd) && admissionSeenAtMs === null) admissionSeenAtMs = Date.now() - clockOrigin;
        if (isRevert(cmd) && revertSeenAtMs === null) revertSeenAtMs = Date.now() - clockOrigin;
        return { result: runRedisLua(script, keys, args, store, ttls) };
      });
      // APPLIED — and then the reply never comes back.
      if (commands.some(isAdmission)) await new Promise(() => {});
      return {
        ok: true,
        status: 200,
        headers: new Map([['upstash-sync-token', 'x']]),
        text: async () => JSON.stringify(batched ? results : results[0]),
      };
    });

    const caller = callHandler();
    await vi.advanceTimersByTimeAsync(3000);
    const result = await caller;

    // 1. The user is answered inside the budget, from the stale entry.
    expect(result.statusCode).toBe(200);
    expect(result.body.meta.serverCache).toBe('stale-deadline');
    expect(result.atMs).toBeLessThanOrEqual(8500 + 400);

    // 2. The admission DID apply — this is a real charge, not a no-op.
    expect(admissionSeenAtMs).not.toBeNull();
    expect(counterKeys().length).toBeGreaterThan(0);

    // 3. Cancellation reached the transport immediately — the first backoff
    //    slot — WITHOUT waiting for the stalled admission reply.
    expect(revertSeenAtMs).not.toBeNull();
    expect(revertSeenAtMs - result.atMs).toBeLessThanOrEqual(REFUND_BACKOFF_MS[0] + 50);

    // 4. Every original counter key is back to zero, while the admission reply
    //    is STILL hanging. Deliberately NOT awaiting keptAlive: one of those
    //    continuations is the stalled charge itself and never settles — which
    //    is the whole point. Advancing the clock is enough, because the
    //    cancellation chain runs on timers and owes nothing to that reply.
    await vi.advanceTimersByTimeAsync(60000);
    expect(counterTotal()).toBe(0);
    expect(keptAlive.length).toBeGreaterThanOrEqual(2); // charge + cancellation
  }, 60000);

  it('H2 stalled admission AND a stalled first cancellation, with the REAL lock helpers: /share still gets its answer', async () => {
    // Round 15, major 1. The handler's finally used to `await` the lock
    // release. Auto-pipelining can batch that release behind an in-flight
    // cancellation, so when the cancellation stalled the handler never
    // resolved — api/share.js does `await weatherHandler(req, res)`, so /share
    // sat with no response at 71.2 s despite servable stale data and zero
    // remaining charges. Release is now bounded, scheduled and unawaited.
    //
    // Everything hostile at once: the real acquire/release helpers over the
    // mocked transport, an admission that applies but never replies, and a
    // first cancellation attempt that also hangs.
    weatherCacheAcquireLock.mockImplementation(
      (key, redis = redisClient, token) => cacheMod.original.weatherCacheAcquireLock(key, redis, token),
    );
    let releaseAttempts = 0;
    let stallCancellations = 1;
    let admissionApplied = 0;

    vi.stubGlobal('fetch', async (url, opts) => {
      const href = String(url);
      if (!href.startsWith(UPSTASH_URL)) throw new Error(`no upstream expected: ${href}`);
      const parsed = JSON.parse(opts.body);
      const batched = Array.isArray(parsed[0]);
      const commands = batched ? parsed : [parsed];

      // The RELEASE_LOCK_SCRIPT is the only eval that deletes a key.
      if (commands.some(c => String(c[1]).includes("redis.call('del'"))) releaseAttempts += 1;

      const results = commands.map((cmd) => {
        if (isAdmission(cmd)) {
          admissionApplied += 1;
          if (admissionSeenAtMs === null) admissionSeenAtMs = Date.now() - clockOrigin;
          // Time already spent elsewhere in the request, so the charge lands
          // right on the deadline — the shape the finding was measured in.
          vi.setSystemTime(new Date(Date.now() + 7000));
        }
        if (isRevertCmd(cmd) && revertSeenAtMs === null) revertSeenAtMs = Date.now() - clockOrigin;
        return { result: runCommand(cmd) };
      });

      // APPLIED, then the reply never comes back.
      if (commands.some(isAdmission)) await new Promise(() => {});
      // ...and the first cancellation hangs too.
      if (commands.some(isRevertCmd) && stallCancellations > 0) {
        stallCancellations -= 1;
        await new Promise(() => {});
      }
      return {
        ok: true,
        status: 200,
        headers: new Map([['upstash-sync-token', 'x']]),
        text: async () => JSON.stringify(batched ? results : results[0]),
      };
    });

    // Record WHEN the handler promise settles, not when the advance window
    // ends — /share's deadline is the moment its await returns.
    let settledAtMs = null;
    const caller = callHandler().then((r) => { settledAtMs = Date.now() - clockOrigin; return r; });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await caller;           // if this hangs, the finding is back
    expect(settledAtMs).not.toBeNull();

    // 1. /share's consumer gets its answer, inside the budget.
    expect(result.statusCode).toBe(200);
    expect(result.body.meta.serverCache).toBe('stale-deadline');
    expect(settledAtMs).toBeLessThanOrEqual(8900);
    expect(result.atMs).toBeLessThanOrEqual(8900);

    // 2. The admission really applied, so there was a real charge to undo.
    expect(admissionApplied).toBeGreaterThan(0);

    // 3. The lock release was attempted — but did not gate the response.
    await vi.advanceTimersByTimeAsync(60000);
    expect(releaseAttempts).toBeGreaterThan(0);

    // 4. After the backoff chain, the original counter keys are back to zero,
    //    with the admission reply still hanging.
    expect(counterTotal()).toBe(0);
  }, 60000);
});
