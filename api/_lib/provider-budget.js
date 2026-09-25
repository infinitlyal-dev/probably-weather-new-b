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
import { waitUntil } from '@vercel/functions';

import { getRedis } from './limiters.js';

// Item 7 round 3: `promise`, or a rejection after `ms` so the caller's catch
// takes the same conservative fallback as a Redis error. ms ≤ 0 → unbounded.
function withTimeout(promise, ms) {
  if (!(ms > 0)) return promise;
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('budget check timed out')), ms); }),
  ]).finally(() => clearTimeout(timeoutId));
}

// --- Open-Meteo: free tier vs commercial (API Standard) --------------------
// Al subscribed to Open-Meteo API Standard (2026-09): 1,000,000 calls/month,
// reserved servers, and NO published per-minute/per-hour/per-day ceiling. The
// budget is therefore a FUNCTION OF THE ENV, not a constant: the free-tier
// minute/day caps apply only when OPEN_METEO_API_KEY is absent and the handler
// is on the free endpoint. Under the commercial plan the monthly counter below
// (advisory, never blocking) is the control instead — the plan has no hard cap,
// so blocking would only manufacture an outage Open-Meteo would not have caused.
const OPEN_METEO_FREE_BUDGET = { perMin: 600, perDay: 10000 }; // Open-Meteo free: 600/min, 10k/day
const OPEN_METEO_COMMERCIAL_BUDGET = {};                       // API Standard: no minute/hour/day ceiling

/** True when the commercial Open-Meteo key is configured for this instance. */
export function hasOpenMeteoKey() {
  return Boolean(process.env.OPEN_METEO_API_KEY);
}

/** Open-Meteo's active budget for the CURRENT env (recomputed per access). */
export function openMeteoBudget() {
  return hasOpenMeteoKey() ? OPEN_METEO_COMMERCIAL_BUDGET : OPEN_METEO_FREE_BUDGET;
}

// 'open-meteo' is a getter so the env is read at use time, not at import time —
// a module-load constant would freeze whichever env the first import happened
// to see (and would make the key's presence untestable).
export const PROVIDER_BUDGETS = {
  get 'open-meteo'() { return openMeteoBudget(); },
  // WeatherAPI free plan (weatherapi.com/pricing.aspx, read 2026-09-25): 100,000
  // calls a MONTH — 3,200/day × 31 = 99,200 keeps a busy month inside it. (The
  // old 30,000/day assumed ~1M/month; that is the $7 Starter plan's 3M.) On
  // Starter, 30,000/day fits again.
  'weatherapi': { perMin: 200, perDay: 3200 },
  // Pirate Weather (pirate-weather.apiable.io plans, read 2026-09-25): 20,000
  // calls/MONTH is the US$3 plan; the free plan is 10,000 and "for personal
  // use", so an app with ads needs the $3 plan this ceiling is sized for.
  'pirate':     { perMin: 20,  perDay: 600 },
  'met':        { perMin: 300 },                // MET Norway: no key; stay courteous
  // Tomorrow.io free (official): 3/second, 25/hour, 500/day.
  'tomorrow':   { perSecond: 3, perHour: 25, perDay: 500 },
  // LocationIQ free plan (locationiq.com/pricing, read 2026-09-15): 2/second,
  // 60/minute, 5,000/day. Production logged 14 HTTP 429s from /api/geocode —
  // a debounced keystroke costs one ZA query plus an unrestricted fallback, so
  // two quick searches exceed 2/second. Every LocationIQ call (search, reverse,
  // the weather handler's name lookup) spends from this one budget, so a burst
  // is refused here instead of by LocationIQ.
  'locationiq': { perSecond: 2, perMin: 60, perDay: 5000 },
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
  // LocationIQ's own 2/second is per token, so it holds per instance too.
  'locationiq': [{ max: 2, windowMs: 1000 }, { max: 30, windowMs: 60000 }],
};
const INSTANCE_FALLBACK_DEFAULT = [{ max: 30, windowMs: 60000 }];

// Commercial Open-Meteo keeps a per-instance outage guard, but sized for the
// plan rather than the free tier: 2,000/min/instance is far above any organic
// rate PW can produce (a full month's 1M allowance is ~23 calls/min sustained),
// so it never throttles real traffic — it exists purely so a Redis outage plus
// a runaway loop cannot bill an unbounded number of calls before anyone notices.
const OPEN_METEO_COMMERCIAL_FALLBACK = [{ max: 2000, windowMs: 60000 }];

function instanceFallbackLimits(provider) {
  if (provider === 'open-meteo' && hasOpenMeteoKey()) return OPEN_METEO_COMMERCIAL_FALLBACK;
  return INSTANCE_FALLBACK_LIMITS[provider] ?? INSTANCE_FALLBACK_DEFAULT;
}

const secondBucket = (nowMs) => Math.floor(nowMs / 1000);
const minBucket = (nowMs) => Math.floor(nowMs / 60000);
const hourBucket = (nowMs) => Math.floor(nowMs / 3600000);
const dayBucket = (nowMs) => Math.floor(nowMs / 86400000);

// One current counter per provider; changing windows replace the old entry.
const _mem = new Map();
function instanceFallbackAllows(provider, nowMs) {
  const limits = instanceFallbackLimits(provider);
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

// --- Open-Meteo monthly usage counter --------------------------------------
// ADVISORY ONLY. The API Standard plan has no hard cap, so this never blocks a
// request; the alert is the control. Counted in Redis under a UTC-month key so
// every Fluid-Compute instance contributes to one number.
//
// The plan is denominated in CALL UNITS, not HTTP requests, so this counter is
// too — counting requests would put the 80% alert ~2.9x too late in billing
// terms. Open-Meteo's pricing page (read 2026-09-14) states:
//
//   "Requests for data covering more than 10 weather variables or extending
//    over a period of more than 2 weeks for a single location are considered
//    multiple API calls."
//   "Fractional counts are used. For example, a request for 2 weeks of data
//    with 15 weather variables will be calculated as 1.5 API calls, while 4
//    weeks of data equals 3.0 API calls."
//
// ⇒ units = max(1, variables/10) × max(1, days/14).
// PW's forecast request: 8 `current` + 13 `hourly` + 8 `daily` parameters = 29,
// forecast_days=7 (days factor 1.0, since 7 < 14) ⇒ 29/10 = 2.9 units.
// 2.9 is the CONSERVATIVE reading. If Open-Meteo de-duplicates variable names
// across the three sections the count is 20 distinct names ⇒ 2.0 units. Which
// one they apply is not published and no response header reports the weight
// (verified against the live endpoint), so we plan on 2.9 and the real spend is
// read off the Open-Meteo customer dashboard.
//
// tests/open-meteo-commercial.test.js derives this number from the request URL
// the handler actually builds, so it cannot drift if a variable is added.
//
// CAPACITY PLANNING — the projection in the commit body uses an ASSUMED cache
// hit rate, not a measured one: there was no /api/weather traffic in the last
// 24 h of Vercel production logs on 2026-09-14 (prelaunch), so there was
// nothing to measure. Re-derive it from real logs once traffic exists.
export const OPEN_METEO_UNITS_PER_REQUEST = 2.9;

// STORAGE: the Redis value is an integer count of TENTHS of a unit, incremented
// with plain INCRBY. Deliberately not INCRBYFLOAT — integer arithmetic is exact
// over the ~345k increments a full month takes, where repeated float addition
// would drift, and it avoids parsing INCRBYFLOAT's string reply. 2.9 units =
// 29 tenths per request; divide by 10 to read units back.
const OPEN_METEO_UNIT_TENTHS = Math.round(OPEN_METEO_UNITS_PER_REQUEST * 10); // 29
// The precision request (api/_lib/precision.js): temperature for four models, 3 days → 4 model-variables,
// under 2 weeks → 1.0 unit.
export const OPEN_METEO_PRECISION_UNIT_TENTHS = 10;
const TENTHS = 10;

const OPEN_METEO_MONTHLY_PLAN = 1_000_000;                       // units/month
const OPEN_METEO_MONTHLY_ALERT_AT = 800_000;                     // 80% of the plan, in UNITS
const OPEN_METEO_MONTHLY_ALERT_AT_TENTHS = OPEN_METEO_MONTHLY_ALERT_AT * TENTHS;
// Log throttle: one routine line per 1,000 UNITS (≈ 345 requests at 2.9), so a
// full 1,000,000-unit month emits ~1,000 lines rather than ~345,000. A modulo
// test cannot be used here: the 29-tenth step is coprime with the 10,000-tenth
// interval, so it would almost never land on an exact multiple. Instead detect
// the BOUNDARY CROSSING between the pre- and post-increment values — exact once
// per interval for any step size, and stateless (derived from the Redis reply,
// so it survives cold starts and concurrent instances).
const OPEN_METEO_MONTHLY_LOG_EVERY_TENTHS = 1000 * TENTHS;
const OPEN_METEO_MONTHLY_TTL_SECONDS = 40 * 86400; // ~40 days — outlives any month

const openMeteoMonthKey = (nowMs) => {
  const d = new Date(nowMs);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `pw-budget:open-meteo:month:${d.getUTCFullYear()}-${month}`;
};

// Hard ceiling on how long the counter may take before we give up on it. The
// count is advisory; the forecast is not. Without this a stalled Upstash would
// hold the Vercel invocation open long after the response was sent.
const OPEN_METEO_MONTHLY_TIMEOUT_MS = 1500;
// Accounting failures are throttled to one line per minute per instance: if
// Redis is broken EVERY request fails to count, and an unthrottled warning
// would bury the logs at exactly the moment they matter.
const OPEN_METEO_ACCOUNTING_WARN_EVERY_MS = 60_000;

let _monthlyRedisWarned = false;
let _accountingWarnedAtMs = 0;

/** Test-only — clear the warning latches (absent client, accounting failures). */
export function _resetOpenMeteoMonthly() {
  _monthlyRedisWarned = false;
  _accountingWarnedAtMs = 0;
}

// A failure here silently disables the 80% alert too — the one signal that is
// supposed to catch overspend — so it must be visible, not swallowed.
function warnAccountingFailed(detail, nowMs) {
  if (_accountingWarnedAtMs !== 0 && nowMs - _accountingWarnedAtMs < OPEN_METEO_ACCOUNTING_WARN_EVERY_MS) return;
  _accountingWarnedAtMs = nowMs;
  console.warn(`[pw-om-monthly] accounting failed: ${detail?.message ?? detail}`);
}

/**
 * Record ONE actual Open-Meteo upstream call — 2.9 call units — against the
 * monthly allowance. Never throws and never blocks: a failure to count is not a
 * reason to fail a weather request. Redis unavailable → count nothing, warn
 * once per instance.
 *
 * @param {object|null} [redis]  injectable Upstash client (defaults to shared)
 * @param {number} [nowMs]       injectable clock for tests
 * @returns {Promise<number|null>} month-to-date UNITS, or null if uncounted
 */
export async function recordOpenMeteoCall(redis = _UNSET, nowMs = Date.now(), unitTenths = OPEN_METEO_UNIT_TENTHS) {
  if (redis === _UNSET) {
    // Handler default path. Under vitest the upstream calls are mocked, so the
    // counter is meaningless; the logic itself is tested with an injected client.
    if (typeof process !== 'undefined' && process.env?.VITEST) return null;
    redis = getRedis();
  }
  if (!redis) {
    if (!_monthlyRedisWarned) {
      _monthlyRedisWarned = true;
      console.warn('[pw-om-monthly] Redis unavailable — Open-Meteo monthly usage is not being counted');
    }
    return null;
  }
  try {
    const key = openMeteoMonthKey(nowMs);
    const tenths = await redis.incrby(key, unitTenths);
    if (tenths === unitTenths) await redis.expire(key, OPEN_METEO_MONTHLY_TTL_SECONDS);
    const units = tenths / TENTHS;
    const pct = ((units / OPEN_METEO_MONTHLY_PLAN) * 100).toFixed(1);
    // At/over 80% of the plan IN UNITS (800,000 units ≈ 275,862 requests):
    // alert on EVERY call, so the signal cannot be missed between throttled
    // routine lines.
    if (tenths >= OPEN_METEO_MONTHLY_ALERT_AT_TENTHS) {
      console.error(`[pw-om-alert] Open-Meteo monthly usage at ${pct}% of ${OPEN_METEO_MONTHLY_PLAN.toLocaleString('en-US')} units`);
    }
    // Crossed a 1,000-unit boundary with this increment? (See the note above on
    // why this is a crossing test and not a modulo test.)
    const before = tenths - unitTenths;
    if (Math.floor(before / OPEN_METEO_MONTHLY_LOG_EVERY_TENTHS)
        < Math.floor(tenths / OPEN_METEO_MONTHLY_LOG_EVERY_TENTHS)) {
      const requests = Math.round(units / OPEN_METEO_UNITS_PER_REQUEST);
      console.log(`[pw-om-monthly] ${units.toFixed(1)}/${OPEN_METEO_MONTHLY_PLAN} units (${pct}%) ≈ ${requests} requests`);
    }
    return units;
  } catch (err) {
    // Advisory counter — a Redis hiccup never fails the request, but it must
    // not fail SILENTLY: a rejected command disables the 80% alert as well.
    warnAccountingFailed(err, nowMs);
    return null;
  }
}

/**
 * Schedule the monthly count OFF the response path.
 *
 * The count is advisory; the forecast is not. Awaiting the INCRBY inline meant a
 * stalled Upstash stalled the forecast even when every provider had already
 * answered. This mirrors weatherCacheSetDeferred: start the work, hand the
 * promise to the Vercel lifecycle so the invocation stays alive until it
 * settles, and never let the caller await it. Bounded by
 * OPEN_METEO_MONTHLY_TIMEOUT_MS so a hung client cannot hold the invocation
 * open indefinitely either.
 *
 * Returns the pending promise for tests; PRODUCTION CALLERS MUST NOT AWAIT IT.
 *
 * @param {object|null} [redis]     injectable Upstash client (defaults to shared)
 * @param {number} [nowMs]          injectable clock for tests
 * @param {Function} [schedule]     injectable scheduler (defaults to waitUntil)
 */
export function recordOpenMeteoCallDeferred(redis = _UNSET, nowMs = Date.now(), schedule = waitUntil, unitTenths = OPEN_METEO_UNIT_TENTHS) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      warnAccountingFailed(`timed out after ${OPEN_METEO_MONTHLY_TIMEOUT_MS} ms`, nowMs);
      resolve(null);
    }, OPEN_METEO_MONTHLY_TIMEOUT_MS);
  });
  const pending = Promise.race([recordOpenMeteoCall(redis, nowMs, unitTenths), timeout])
    .catch((err) => { warnAccountingFailed(err, nowMs); return null; })
    .finally(() => clearTimeout(timer));
  try {
    schedule(pending);
  } catch {
    // The count was already started. Absorb rejection: this counter is
    // explicitly advisory and must never turn a forecast into a 500.
    pending.catch(() => {});
  }
  return pending;
}

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
export async function consumeProviderBudgets(providers, redis = _UNSET, nowMs = Date.now(), { timeoutMs = 0 } = {}) {
  const result = {};
  if (redis === _UNSET) {
    // Default (handler) path. Under vitest the upstream calls are mocked, so
    // the budget is meaningless and would otherwise trip the conservative
    // instance fallback across a test file's many handler invocations. Skip it.
    // The guard's own logic is unit-tested directly with an injected client.
    // PW_TEST_REAL_BUDGET=1 opts a targeted handler test back into the real
    // path (with its own injected Redis via limiters.getRedis).
    if (typeof process !== 'undefined' && process.env?.VITEST && !process.env.PW_TEST_REAL_BUDGET) {
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
      // No configured window (commercial Open-Meteo) — nothing to consume, and
      // no reason to spend a Redis round-trip proving it.
      if (windows.length === 0) { result[p] = true; return; }
      const keys = windows.map(([key]) => key);
      const args = windows.flatMap(([, ceiling, ttl, revert]) => [String(ceiling), String(ttl), String(revert)]);
      // Item 7 round 3: bounded PER PROVIDER (timeoutMs > 0). A check that
      // completes keeps its decision — an explicit denial stays a denial —
      // and only a check that runs out of time takes the conservative
      // per-instance fallback, the same path as a Redis error.
      const allowed = await withTimeout(redis.eval(CONSUME_WINDOWS_SCRIPT, keys, args), timeoutMs);
      result[p] = allowed === 1 || allowed === '1' || allowed === true;
    } catch {
      // Redis hiccup for this provider — conservative per-instance fallback.
      result[p] = instanceFallbackAllows(p, nowMs);
    }
  }));
  return result;
}
