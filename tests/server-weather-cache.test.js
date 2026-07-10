// Group 5 — rounded-coords server-side ensemble cache (api/_lib/weather-cache.js).
//
// The cache key snaps to 0.02° (~2.2 km) so a suburb shares one Upstash entry
// per 5-minute TTL instead of every GPS coordinate fanning out to all five
// providers. Fail-open everywhere: no Redis → miss; Redis throws → miss/no-op.

import { describe, expect, it, vi } from 'vitest';

import {
  SNAP_DEGREES,
  WEATHER_CACHE_TTL_SECONDS,
  WEATHER_LOCK_TTL_SECONDS,
  WEATHER_LOCK_WAIT_MS,
  WEATHER_STALE_TTL_SECONDS,
  cacheableLocationName,
  responseLocationName,
  snapCoord,
  waitForWeatherCache,
  weatherCacheAcquireLock,
  weatherCacheGet,
  weatherCacheGetStale,
  weatherCacheKey,
  weatherCacheSet,
  weatherCacheSetDeferred,
} from '../api/_lib/weather-cache.js';
import { LOCAL_MISS_WAIT_MS, WEATHER_UPSTREAM_TIMEOUT_MS } from '../api/weather.js';

const fakeRedis = (store = new Map()) => ({
  store,
  setCalls: [],
  async get(key) { return store.get(key) ?? null; },
  async set(key, value, opts) { this.setCalls.push({ key, value, opts }); store.set(key, value); },
});

describe('snapCoord — 0.02° cache grid', () => {
  it('snaps to the nearest 0.02° and formats to exactly two decimals', () => {
    expect(snapCoord(-34.1163)).toBe('-34.12');
    expect(snapCoord(18.8362)).toBe('18.84');
    expect(snapCoord(0.0099)).toBe('0.00');
    expect(snapCoord(0.0101)).toBe('0.02');
  });

  it('collapses coords within the same ~2 km cell to one value', () => {
    // Two GPS fixes ~400 m apart in Strand.
    expect(snapCoord(-34.118)).toBe(snapCoord(-34.122));
  });

  it('separates coords in different cells', () => {
    expect(snapCoord(-34.10)).not.toBe(snapCoord(-34.14));
  });

  it('never emits float artifacts or -0', () => {
    expect(snapCoord(-0.001)).toBe('0.00');
    for (const v of [18.83, -33.97, 25.0001, -22.555]) {
      expect(snapCoord(v)).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it('returns null for junk', () => {
    expect(snapCoord(NaN)).toBe(null);
    expect(snapCoord(Infinity)).toBe(null);
    expect(snapCoord(undefined)).toBe(null);
  });

  it('grid constant is the documented 0.02', () => {
    expect(SNAP_DEGREES).toBe(0.02);
  });
});

describe('weatherCacheKey', () => {
  it('builds a versioned key from snapped coords', () => {
    expect(weatherCacheKey(-34.1163, 18.8362)).toBe('pw-wx:v2:-34.12,18.84');
  });

  it('nearby coords share a key; distant coords do not', () => {
    const a = weatherCacheKey(-34.118, 18.835);
    const b = weatherCacheKey(-34.121, 18.838);
    const far = weatherCacheKey(-33.918, 18.423); // Cape Town CBD
    expect(a).toBe(b);
    expect(a).not.toBe(far);
  });

  it('returns null when either coord is invalid', () => {
    expect(weatherCacheKey(NaN, 18)).toBe(null);
    expect(weatherCacheKey(-34, undefined)).toBe(null);
  });
});

describe('weatherCacheGet / weatherCacheSet', () => {
  const okPayload = { ok: true, location: { name: 'Strand, Western Cape' }, meta: { localHour: 14 } };

  it('round-trips an ok payload with the standard TTL', async () => {
    const redis = fakeRedis();
    const key = weatherCacheKey(-34.1163, 18.8362);
    expect(await weatherCacheSet(key, okPayload, redis)).toBe(true);
    expect(redis.setCalls[0].opts).toEqual({ ex: WEATHER_CACHE_TTL_SECONDS });
    expect(WEATHER_CACHE_TTL_SECONDS).toBe(300);
    const hit = await weatherCacheGet(key, redis);
    expect(hit).toEqual(okPayload);
  });

  it('P3 writes and serves a longer-lived stale shadow for lock waiters', async () => {
    const redis = fakeRedis();
    const key = weatherCacheKey(-34.1163, 18.8362);
    await weatherCacheSet(key, okPayload, redis);

    expect(redis.setCalls).toHaveLength(2);
    expect(redis.setCalls[1].opts).toEqual({ ex: WEATHER_STALE_TTL_SECONDS });
    expect(await weatherCacheGetStale(key, redis)).toEqual(okPayload);
  });

  it('returns null on a cold key (miss)', async () => {
    expect(await weatherCacheGet('pw-wx:v2:0.00,0.00', fakeRedis())).toBe(null);
  });

  it('refuses to cache non-ok payloads — a degraded response must not be served to a suburb', async () => {
    const redis = fakeRedis();
    expect(await weatherCacheSet('k', { ok: false, error: 'oops' }, redis)).toBe(false);
    expect(await weatherCacheSet('k', null, redis)).toBe(false);
    expect(redis.setCalls).toHaveLength(0);
  });

  it('refuses to serve a cached non-ok payload', async () => {
    const redis = fakeRedis(new Map([['k', { ok: false }]]));
    expect(await weatherCacheGet('k', redis)).toBe(null);
  });

  it('fail-open: no redis client → miss / no-op, never a throw', async () => {
    expect(await weatherCacheGet('k', null)).toBe(null);
    expect(await weatherCacheSet('k', okPayload, null)).toBe(false);
  });

  it('fail-open: a throwing redis → miss / no-op, never a throw', async () => {
    const broken = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    expect(await weatherCacheGet('k', broken)).toBe(null);
    expect(await weatherCacheSet('k', okPayload, broken)).toBe(false);
  });

  it('tolerates string-serialised values from older clients', async () => {
    const redis = fakeRedis(new Map([['k', JSON.stringify(okPayload)]]));
    expect(await weatherCacheGet('k', redis)).toEqual(okPayload);
  });

  it('null key (junk coords) is a miss and a no-op set', async () => {
    const redis = fakeRedis();
    expect(await weatherCacheGet(null, redis)).toBe(null);
    expect(await weatherCacheSet(null, okPayload, redis)).toBe(false);
  });
});

describe('P5 deferred final cache write', () => {
  it('P5 hands the complete final cache write to a lifecycle scheduler', async () => {
    const redis = fakeRedis();
    const scheduled = [];
    const payload = { ok: true, location: { name: 'Strand, Western Cape' } };
    const accepted = weatherCacheSetDeferred('cell', payload, redis, (promise) => scheduled.push(promise));

    expect(accepted).toBe(true);
    expect(scheduled).toHaveLength(1);
    await scheduled[0];
    expect(await weatherCacheGet('cell', redis)).toEqual(payload);
  });
});

describe('P3 distributed miss lock', () => {
  it('P3 coalescing windows cover sequential location and provider timeouts', () => {
    const slowSuccessfulLeaderMs = WEATHER_UPSTREAM_TIMEOUT_MS * 2;
    expect(LOCAL_MISS_WAIT_MS).toBeGreaterThan(slowSuccessfulLeaderMs);
    expect(WEATHER_LOCK_WAIT_MS).toBeGreaterThan(slowSuccessfulLeaderMs);
    expect(WEATHER_LOCK_TTL_SECONDS * 1000).toBeGreaterThan(WEATHER_LOCK_WAIT_MS);
  });

  it('P3 grants one Redis lock holder and releases only its token', async () => {
    const store = new Map();
    const redis = {
      evalCalls: [],
      async set(key, value, options) {
        if (options?.nx && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
      async eval(script, keys, args) {
        this.evalCalls.push({ script, keys, args });
        if (store.get(keys[0]) === args[0]) { store.delete(keys[0]); return 1; }
        return 0;
      },
    };

    const first = await weatherCacheAcquireLock('cell', redis, 'holder-a');
    const second = await weatherCacheAcquireLock('cell', redis, 'holder-b');
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    await first.release();
    expect(redis.evalCalls).toHaveLength(1);
    expect((await weatherCacheAcquireLock('cell', redis, 'holder-c')).acquired).toBe(true);
  });

  it('P3 bounds a dead lock-holder wait and returns null so the caller can proceed', async () => {
    const redis = { get: vi.fn(async () => null) };
    const start = performance.now();
    const result = await waitForWeatherCache('cell', redis, { maxWaitMs: 30, pollMs: 5 });
    const elapsed = performance.now() - start;

    expect(result).toBe(null);
    expect(elapsed).toBeGreaterThanOrEqual(20);
    expect(elapsed).toBeLessThan(250);
  });
});

// HIGH-3 — caller A's &name= must never reach caller B (cache poisoning).
describe('cacheableLocationName — only the server-resolved name is cacheable', () => {
  it('caches the server-resolved name when present', () => {
    expect(cacheableLocationName('Strand, Western Cape')).toBe('Strand, Western Cape');
  });
  it("a caller-supplied name is NEVER what gets cached — only serverResolved feeds it", () => {
    // The function takes ONLY serverResolvedName; the caller's &name= is not a
    // parameter, so it structurally cannot be cached. No server name → 'Unknown'.
    expect(cacheableLocationName(null)).toBe('Unknown');
    expect(cacheableLocationName('')).toBe('Unknown');
    expect(cacheableLocationName(undefined)).toBe('Unknown');
  });
  it("an unresolved coords-shaped name is not cached as resolved (caches 'Unknown')", () => {
    // serverResolvedName stays null when LocationIQ is down; the coords string
    // lives only in the caller-supplied `name`, which never reaches here (M-i).
    expect(cacheableLocationName(null)).toBe('Unknown');
  });
});

describe('responseLocationName — the cross-user poisoning chain is severed', () => {
  it('a non-placeholder caller keeps their OWN name (not the cache)', () => {
    expect(responseLocationName({ isPlaceholder: false, callerName: 'My Spot', cachedName: 'Strand' }))
      .toBe('My Spot');
  });
  it('a placeholder caller gets the cached SERVER-resolved name', () => {
    expect(responseLocationName({ isPlaceholder: true, callerName: 'My Location', cachedName: 'Strand, Western Cape' }))
      .toBe('Strand, Western Cape');
  });
  it("a placeholder caller with no cached name gets 'Unknown' (client re-resolves)", () => {
    expect(responseLocationName({ isPlaceholder: true, callerName: 'My Location', cachedName: 'Unknown' }))
      .toBe('Unknown');
    expect(responseLocationName({ isPlaceholder: true, callerName: 'My Location', cachedName: null }))
      .toBe('Unknown');
  });

  it("end-to-end: attacker A's arbitrary name cannot surface for placeholder caller B", () => {
    // A sends a non-placeholder &name= → server caches only its OWN resolved
    // name. Simulate A resolving nothing server-side (so cache holds 'Unknown')
    // and confirm B (a placeholder GPS first-open) never sees A's string.
    const aSuppliedName = '<script>EVIL</script> 42 Oak Ave';
    const cachedForCell = cacheableLocationName(/* serverResolvedName */ null); // A supplied a name, LocationIQ skipped
    expect(cachedForCell).toBe('Unknown');
    expect(cachedForCell).not.toContain('Oak Ave');
    const bSees = responseLocationName({ isPlaceholder: true, callerName: 'My Location', cachedName: cachedForCell });
    expect(bSees).toBe('Unknown');
    expect(bSees).not.toContain('Oak Ave');
    expect(bSees).not.toBe(aSuppliedName);
  });
});
