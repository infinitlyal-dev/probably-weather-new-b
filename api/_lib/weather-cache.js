// Server-side ensemble response cache — rounded-coordinate keys on the same
// Upstash Redis the rate limiter already uses.
//
// WHY: Vercel's edge cache (s-maxage=300) only dedupes EXACT lat/lon strings.
// GPS users never collide on exact coords, so every open in a city fans out
// to all five providers. Snapping the key to 0.02° (~2.2 km) collapses a
// whole suburb into one entry per 5 minutes — the difference between the
// free provider tiers holding at 10k DAU (Pirate Weather: 20k calls/MONTH)
// and dying in week one.
//
// FAIL-OPEN is load-bearing, same contract as rate-limit.js: missing env,
// Redis outage, malformed payload → cache miss / no-op set. The cache must
// never be the reason a forecast fails.

import { randomUUID } from 'node:crypto';
import { getRedis } from './limiters.js';

export const WEATHER_CACHE_TTL_SECONDS = 300; // mirrors the edge s-maxage
export const WEATHER_STALE_TTL_SECONDS = 900;
export const WEATHER_LOCK_TTL_SECONDS = 30;
export const WEATHER_LOCK_WAIT_MS = 22000;
export const SNAP_DEGREES = 0.02;             // ~2.2 km latitude

const weatherCacheStaleKey = (key) => `${key}:stale`;
const weatherCacheLockKey = (key) => `${key}:lock`;
const RELEASE_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;

/**
 * Snap a coordinate to the cache grid. Returns a STRING with exactly two
 * decimals so float artifacts (0.060000000000000005) can't fragment keys.
 */
export function snapCoord(value) {
  if (!Number.isFinite(value)) return null;
  const snapped = Math.round(value / SNAP_DEGREES) * SNAP_DEGREES;
  // +0 normalises -0 so "-0.00" never appears in a key.
  return (snapped + 0).toFixed(2);
}

// HIGH-3 — location-name handling that keeps one caller's name from leaking to
// (and being persisted by) another caller in the same cell.

/**
 * The location name that is SAFE to cache and re-serve to OTHER callers in a
 * cell: the server-resolved (LocationIQ) name only — NEVER a caller-supplied
 * `&name=`. When the server resolved nothing, returns 'Unknown', which the
 * client treats as a placeholder and re-resolves itself (so an unresolved or
 * coords-shaped name is never cached as if it were resolved).
 */
export function cacheableLocationName(serverResolvedName) {
  return serverResolvedName || 'Unknown';
}

/**
 * The location name to SHOW the current caller. A non-placeholder caller keeps
 * their own real name; a placeholder caller gets the cached server-resolved
 * name, or 'Unknown' (which the client re-resolves). Because the cache only
 * ever holds a server-resolved name (see cacheableLocationName), this can never
 * surface another caller's supplied string.
 */
export function responseLocationName({ isPlaceholder, callerName, cachedName }) {
  if (!isPlaceholder && callerName) return callerName;
  return cachedName || 'Unknown';
}

/**
 * Cache key for a coordinate pair, or null when either coord is junk.
 *
 * Key VERSION bumped v1→v2 (2026-06-12) so the HIGH-3 name-poisoning fix takes
 * effect instantly: every pre-fix `pw-wx:v1` entry (which could still hold a
 * caller-supplied name) is abandoned the moment this ships, rather than
 * remaining servable for up to its 5-min TTL. Bump this version on any change
 * to the cached payload's shape or trust assumptions.
 */
export function weatherCacheKey(lat, lon) {
  const sLat = snapCoord(lat);
  const sLon = snapCoord(lon);
  if (sLat === null || sLon === null) return null;
  return `pw-wx:v2:${sLat},${sLon}`;
}

/**
 * Fetch a cached ensemble payload. Returns the parsed payload object or null.
 * `redis` is injectable for tests; defaults to the shared Upstash client
 * (null when env is missing → permanent miss, fail-open).
 */
export async function weatherCacheGet(key, redis = getRedis()) {
  if (!key || !redis) return null;
  try {
    const value = await redis.get(key);
    if (!value) return null;
    // @upstash/redis deserialises JSON automatically; tolerate a string from
    // an injected test double or an older client.
    const payload = typeof value === 'string' ? JSON.parse(value) : value;
    return payload && payload.ok === true ? payload : null;
  } catch {
    return null; // fail-open: Redis trouble = cache miss
  }
}

/** Last successful value retained beyond the fresh TTL for lock waiters only. */
export async function weatherCacheGetStale(key, redis = getRedis()) {
  return weatherCacheGet(key ? weatherCacheStaleKey(key) : null, redis);
}

/**
 * Store an ensemble payload under `key` with the standard TTL. Never throws.
 * Only ok:true payloads are cached — a degraded/error response must not be
 * served to a whole suburb for 5 minutes.
 */
export async function weatherCacheSet(key, payload, redis = getRedis()) {
  if (!key || !redis || !payload || payload.ok !== true) return false;
  try {
    const serialized = JSON.stringify(payload);
    await Promise.all([
      redis.set(key, serialized, { ex: WEATHER_CACHE_TTL_SECONDS }),
      redis.set(weatherCacheStaleKey(key), serialized, { ex: WEATHER_STALE_TTL_SECONDS }),
    ]);
    return true;
  } catch {
    return false; // fail-open
  }
}

/**
 * Claim the short distributed miss lock. No Redis or Redis failure fails open:
 * this instance proceeds, while the per-instance promise map still coalesces.
 */
export async function weatherCacheAcquireLock(key, redis = getRedis(), token = randomUUID()) {
  if (!key || !redis) return { acquired: true, release: async () => {} };
  const lockKey = weatherCacheLockKey(key);
  try {
    const result = await redis.set(lockKey, token, { nx: true, ex: WEATHER_LOCK_TTL_SECONDS });
    const acquired = result === 'OK' || result === true;
    return {
      acquired,
      release: async () => {
        if (!acquired) return;
        try { await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [token]); } catch { /* lock expires */ }
      },
    };
  } catch {
    return { acquired: true, release: async () => {} };
  }
}

/** Poll for the lock holder's fresh value, but never wait indefinitely. */
export async function waitForWeatherCache(
  key,
  redis = getRedis(),
  { maxWaitMs = WEATHER_LOCK_WAIT_MS, pollMs = 200 } = {},
) {
  if (!key || !redis) return null;
  const deadline = Date.now() + Math.max(0, maxWaitMs);
  do {
    const cached = await weatherCacheGet(key, redis);
    if (cached) return cached;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(1, pollMs), remaining)));
  } while (Date.now() < deadline);
  return weatherCacheGet(key, redis);
}
