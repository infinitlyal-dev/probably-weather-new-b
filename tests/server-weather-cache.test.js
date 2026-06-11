// Group 5 — rounded-coords server-side ensemble cache (api/_lib/weather-cache.js).
//
// The cache key snaps to 0.02° (~2.2 km) so a suburb shares one Upstash entry
// per 5-minute TTL instead of every GPS coordinate fanning out to all five
// providers. Fail-open everywhere: no Redis → miss; Redis throws → miss/no-op.

import { describe, expect, it, vi } from 'vitest';

import {
  SNAP_DEGREES,
  WEATHER_CACHE_TTL_SECONDS,
  snapCoord,
  weatherCacheGet,
  weatherCacheKey,
  weatherCacheSet,
} from '../api/_lib/weather-cache.js';

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
    expect(weatherCacheKey(-34.1163, 18.8362)).toBe('pw-wx:v1:-34.12,18.84');
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

  it('returns null on a cold key (miss)', async () => {
    expect(await weatherCacheGet('pw-wx:v1:0.00,0.00', fakeRedis())).toBe(null);
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
