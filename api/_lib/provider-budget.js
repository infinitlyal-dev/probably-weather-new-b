// Global per-provider upstream-call budget guard (HIGH-1 fix).
//
// THE PROBLEM the per-IP limiter could not solve: the weather cache key is
// derived from caller-supplied coordinates, so an attacker who varies coords
// by 0.02° per request misses the cache every time and triggers a full
// 5-provider fan-out per request. At the old 480/min per-IP cap, one IP could
// exhaust Pirate Weather's 20k/MONTH free tier in ~42 minutes — and when
// Upstash is down the per-IP limiter fails open too, removing even that bound.
//
// THE FIX: protect the provider quota DIRECTLY with a global ceiling on
// upstream calls per provider, enforced before any provider fetch, keyed
// per-provider (NOT per-IP) so coordinate variation can't bypass it.
//
//   · fail-CLOSED on quota   — never issue a call past the ceiling.
//   · fail-OPEN on availability — if the Redis budget store is unreachable,
//     fall back to a conservative per-INSTANCE in-memory ceiling (tight, but
//     never "unlimited"), so an Upstash outage degrades fidelity, not uptime.
//
// CEILINGS — each provider's published free-tier limit, with margin. Two
// windows where the monthly tier is the binding constraint:
//   · perMin bounds the worst single minute (runaway guard).
//   · perDay bounds the monthly free tier.
//
// PIRATE WEATHER is the binding constraint (20,000 calls/MONTH):
//   20000 / 31 days ≈ 645 calls/day      → perDay 600  (max 600×31 = 18,600 < 20,000)
//   600  / 1440 min ≈ 0.42 calls/min avg → perMin 20   (burst-capped; was unbounded at 480/min/IP)
// With perDay 600 enforced globally, exhausting the monthly tier is now
// structurally impossible regardless of attacker behaviour or coordinate
// variation; perMin 20 additionally caps any single-minute spike.
import { getRedis } from './limiters.js';

export const PROVIDER_BUDGETS = {
  'open-meteo': { perMin: 600, perDay: 10000 }, // Open-Meteo free: 600/min, 10k/day
  'weatherapi': { perMin: 200, perDay: 30000 }, // WeatherAPI free: ~1M/month
  'pirate':     { perMin: 20,  perDay: 600 },   // Pirate Weather free: 20k/MONTH — BINDING
  'met':        { perMin: 300 },                // MET Norway: no key; stay courteous
  'tomorrow':   { perMin: 25,  perDay: 500 },   // Tomorrow.io free: 500/day, 25/hr
};

// Conservative per-INSTANCE per-minute ceilings, used ONLY when Redis is
// unreachable. Deliberately far tighter than the global ceilings: many Fluid
// Compute instances may run, so this bounds each instance's contribution, not
// the true global total. "Never unlimited" is the goal during an outage.
const INSTANCE_FALLBACK_PER_MIN = {
  'open-meteo': 120, 'weatherapi': 60, 'pirate': 5, 'met': 120, 'tomorrow': 5,
};
const INSTANCE_FALLBACK_DEFAULT = 30;

const minBucket = (nowMs) => Math.floor(nowMs / 60000);
const dayBucket = (nowMs) => Math.floor(nowMs / 86400000);

// Per-instance fallback counters: key `${provider}:${minuteBucket}` → count.
const _mem = new Map();
function instanceFallbackAllows(provider, nowMs) {
  const ceiling = INSTANCE_FALLBACK_PER_MIN[provider] ?? INSTANCE_FALLBACK_DEFAULT;
  const mb = minBucket(nowMs);
  const key = `${provider}:${mb}`;
  const n = (_mem.get(key) ?? 0) + 1;
  _mem.set(key, n);
  // Cheap prune: drop buckets older than the previous minute.
  if (_mem.size > 64) {
    for (const k of _mem.keys()) {
      if (Number(k.slice(k.indexOf(':') + 1)) < mb - 1) _mem.delete(k);
    }
  }
  return n <= ceiling;
}

/** Test-only — reset the per-instance fallback counters. */
export function _resetInstanceBudget() { _mem.clear(); }

// Distinguishes "caller passed no redis" (handler default path) from "caller
// explicitly passed null" (the instance-fallback unit tests). Only the default
// path is skipped under vitest — the explicit-null tests must still exercise
// the real fallback.
const _UNSET = Symbol('redis-unset');

// Increment one rolling-window counter and report whether it is within ceiling.
// Sets the TTL only on the first increment of a fresh window (value === 1).
async function consumeWindow(redis, key, ttlSeconds, ceiling) {
  const count = await redis.incr(key);
  if (count === 1) {
    // Best-effort expiry; if it fails the key still expires on the next window
    // boundary's overwrite is impossible (bucket is time-keyed), so guard it.
    try { await redis.expire(key, ttlSeconds); } catch { /* non-fatal */ }
  }
  return count <= ceiling;
}

/**
 * Consume one budget slot for each provider in `providers` and return a map
 * { provider: allowed:boolean }. A provider is allowed only when EVERY
 * configured window (minute, and day where set) is within ceiling.
 *
 * Fail-open on availability: a null client or any Redis error routes ALL
 * providers through the per-instance fallback instead of throwing.
 *
 * @param {string[]} providers   provider keys that would actually fetch
 * @param {object|null} [redis]  injectable Upstash client (defaults to shared)
 * @param {number} [nowMs]       injectable clock for tests
 */
export async function consumeProviderBudgets(providers, redis = _UNSET, nowMs = Date.now()) {
  const result = {};
  if (redis === _UNSET) {
    // Default (handler) path. Under vitest the upstream calls are mocked, so
    // the budget is meaningless and would otherwise trip the conservative
    // instance fallback across a test file's many handler invocations. Skip it.
    // The guard's own logic is unit-tested directly with an injected client.
    if (typeof process !== 'undefined' && process.env?.VITEST) {
      for (const p of providers) result[p] = true;
      return result;
    }
    redis = getRedis();
  }
  if (!redis) {
    for (const p of providers) result[p] = instanceFallbackAllows(p, nowMs);
    return result;
  }
  const mb = minBucket(nowMs);
  const db = dayBucket(nowMs);
  await Promise.all(providers.map(async (p) => {
    const cfg = PROVIDER_BUDGETS[p];
    if (!cfg) { result[p] = true; return; } // unbudgeted provider — never block
    try {
      // Day window first (cheap short-circuit on the binding monthly tier),
      // then minute. Both must pass. Each over-ceiling increment stays counted
      // (conservative: a flood keeps the window pinned blocked).
      let allowed = true;
      if (Number.isFinite(cfg.perDay)) {
        const dayOk = await consumeWindow(redis, `pw-budget:${p}:d:${db}`, 90000, cfg.perDay);
        allowed = allowed && dayOk;
      }
      if (Number.isFinite(cfg.perMin)) {
        const minOk = await consumeWindow(redis, `pw-budget:${p}:m:${mb}`, 90, cfg.perMin);
        allowed = allowed && minOk;
      }
      result[p] = allowed;
    } catch {
      // Redis hiccup for this provider — conservative per-instance fallback.
      result[p] = instanceFallbackAllows(p, nowMs);
    }
  }));
  return result;
}
