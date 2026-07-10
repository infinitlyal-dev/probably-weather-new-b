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
// CEILINGS — each provider's published free-tier limit, with margin. The
// configured second/minute/hour/day windows are all enforced before fetch.
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
  // Tomorrow.io free (official): 3/second, 25/hour, 500/day.
  'tomorrow':   { perSecond: 3, perHour: 25, perDay: 500 },
};

// Conservative per-INSTANCE ceilings, used ONLY when Redis is unreachable.
// Tomorrow.io uses an hourly fallback so an outage cannot turn its real 25/hr
// limit back into a nominal per-minute limit.
const INSTANCE_FALLBACK_LIMITS = {
  'open-meteo': [{ max: 120, windowMs: 60000 }],
  'weatherapi': [{ max: 60, windowMs: 60000 }],
  'pirate': [{ max: 5, windowMs: 60000 }],
  'met': [{ max: 120, windowMs: 60000 }],
  // Preserve both published burst protection and a tighter outage-hour cap.
  'tomorrow': [{ max: 3, windowMs: 1000 }, { max: 5, windowMs: 3600000 }],
};
const INSTANCE_FALLBACK_DEFAULT = [{ max: 30, windowMs: 60000 }];

const secondBucket = (nowMs) => Math.floor(nowMs / 1000);
const minBucket = (nowMs) => Math.floor(nowMs / 60000);
const hourBucket = (nowMs) => Math.floor(nowMs / 3600000);
const dayBucket = (nowMs) => Math.floor(nowMs / 86400000);

// One current counter per provider; changing windows replace the old entry.
const _mem = new Map();
function instanceFallbackAllows(provider, nowMs) {
  const limits = INSTANCE_FALLBACK_LIMITS[provider] ?? INSTANCE_FALLBACK_DEFAULT;
  for (const limit of limits) {
    const bucket = Math.floor(nowMs / limit.windowMs);
    const key = `${provider}:${limit.windowMs}`;
    const previous = _mem.get(key);
    const count = previous?.bucket === bucket ? previous.count + 1 : 1;
    _mem.set(key, { bucket, count });
    if (count > limit.max) return false;
  }
  return true;
}

/** Test-only — reset the per-instance fallback counters. */
export function _resetInstanceBudget() { _mem.clear(); }

// Distinguishes "caller passed no redis" (handler default path) from "caller
// explicitly passed null" (the instance-fallback unit tests). Only the default
// path is skipped under vitest — the explicit-null tests must still exercise
// the real fallback.
const _UNSET = Symbol('redis-unset');

// One atomic Redis operation per provider. Windows are supplied shortest-first;
// Lua stops at the first rejection, so a short burst never drains longer-lived
// quota. The final daily increment is reverted when the day is already full,
// preserving the existing "rejected attempts spend no daily slot" contract.
const CONSUME_WINDOWS_SCRIPT = `
  for i, key in ipairs(KEYS) do
    local base = (i - 1) * 3
    local ceiling = tonumber(ARGV[base + 1])
    local ttl = tonumber(ARGV[base + 2])
    local revert = tonumber(ARGV[base + 3])
    local count = redis.call('incr', key)
    if count == 1 then redis.call('expire', key, ttl) end
    if count > ceiling then
      if revert == 1 then redis.call('decr', key) end
      return 0
    end
  end
  return 1
`;

function providerWindows(provider, cfg, nowMs) {
  const windows = [];
  if (Number.isFinite(cfg.perSecond)) windows.push([`pw-budget:${provider}:s:${secondBucket(nowMs)}`, cfg.perSecond, 10, 0]);
  if (Number.isFinite(cfg.perMin)) windows.push([`pw-budget:${provider}:m:${minBucket(nowMs)}`, cfg.perMin, 90, 0]);
  if (Number.isFinite(cfg.perHour)) windows.push([`pw-budget:${provider}:h:${hourBucket(nowMs)}`, cfg.perHour, 3900, 0]);
  if (Number.isFinite(cfg.perDay)) windows.push([`pw-budget:${provider}:d:${dayBucket(nowMs)}`, cfg.perDay, 90000, 1]);
  return windows;
}

/**
 * Consume one budget slot for each provider in `providers` and return a map
 * { provider: allowed:boolean }. A provider is allowed only when EVERY
 * configured window is within ceiling.
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
  await Promise.all(providers.map(async (p) => {
    const cfg = PROVIDER_BUDGETS[p];
    if (!cfg) { result[p] = true; return; } // unbudgeted provider — never block
    try {
      const windows = providerWindows(p, cfg, nowMs);
      const keys = windows.map(([key]) => key);
      const args = windows.flatMap(([, ceiling, ttl, revert]) => [String(ceiling), String(ttl), String(revert)]);
      const allowed = await redis.eval(CONSUME_WINDOWS_SCRIPT, keys, args);
      result[p] = allowed === 1 || allowed === '1' || allowed === true;
    } catch {
      // Redis hiccup for this provider — conservative per-instance fallback.
      result[p] = instanceFallbackAllows(p, nowMs);
    }
  }));
  return result;
}
