// Upstash-backed rate limiters. Isolated from the pure decision layer
// (./rate-limit.js) so the @upstash import only loads on the server path.
//
// Env: the Vercel↔Upstash integration provisions KV-FLAVOUR names —
//   UPSTASH_KV_REST_API_URL + UPSTASH_KV_REST_API_TOKEN
// (NOT the bare UPSTASH_REDIS_REST_URL/TOKEN). When either is absent we return
// null → checkRateLimit() fails open (rate limiting disabled), so local runs,
// tests, and a mis-provisioned deploy never crash or block requests.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Caps (sliding windows).
//
// M7 (2026-06-11): resized for SA carrier CGNAT. "Per IP" on mobile here means
// per NAT gateway — MTN/Vodacom put hundreds-to-thousands of users behind one
// public IP, and each search renders up to ~8 mini weather calls. The old
// weather/geocode 60/min could trip on ORGANIC traffic from one busy carrier
// IP, and every 429 on ?reverse=1 used to seed the coords-name bug (H2 — now
// non-destructive, but a 429 still costs the user a name resolution).
//
// 2026-06-12 (HIGH-1 fix): the per-IP weather cap is no longer the quota
// guard. Provider quota is now protected DIRECTLY by the global per-provider
// budget (api/_lib/provider-budget.js), which a coordinate-varying attacker
// cannot bypass (the per-IP cap could — every varied coord misses the cache).
// So the per-IP cap is now purely ABUSE-DAMPENING: stop one IP from
// monopolising function concurrency / Redis, not from burning provider quota.
//
//   · geocode 240 — search-as-you-type + reverse-geocode bursts.
//   · errors   30 — pure log-spam vector; stays tight (error reporting is
//     client-capped at 10/session, so 30/min/IP is already generous).
//   · og       60 — crawler previews are bursty, but a single IP has no valid
//     reason to trigger more than one expensive image render per second.
//
// -----------------------------------------------------------------------
// THE FOUR WEATHER BUCKETS (prelaunch item 1, Astra P0-1, 2026-09-14)
// -----------------------------------------------------------------------
// Before this item: a flat 240/IP/minute and 300/IP/day, BOTH charged at the
// top of the handler, ahead of the server weather-cache lookup. Two faults,
// and both hit legitimate SA users hardest:
//   · a cache HIT — no upstream call, no provider quota spent — still spent
//     both allowances, so the cache made the limits harsher, not gentler;
//   · behind carrier-grade NAT the allowance was shared by everyone on the
//     gateway. Astra's simulation of the first fix: 241 distinct installs
//     behind one carrier IP, all served from a warm cache, still produced 240
//     successes and one 429 — because the MINUTE limiter was still in front
//     of the cache.
//
// Now the cache lookup and the coalescing/lock layers run BEFORE every one of
// these buckets, so a request answered from cache (hit, coalesced-local,
// coalesced-redis, stale-lock-wait) touches NO counter at all. Every bucket
// below therefore meters UNCACHED UPSTREAM WORK ONLY: a provider fan-out, or
// a ?reverse=1 LocationIQ lookup. That is what makes per-install numbers this
// small safe — they are not counting app opens, they are counting the rare
// open that actually has to go upstream.
//
// Keyed two ways, because one public IP is not one person here:
//   · *Install — `${ip}:${installId}`, where installId is a random value the
//     client mints once and stores in localStorage (assets/app.js, header
//     X-PW-Install). It identifies a browser install for bookkeeping, not a
//     person. This is the bucket that actually governs a user.
//   · *Ip — the bare IP. A flood ceiling only, sized for a whole carrier NAT
//     gateway, not for one human.
//
// BURST PROFILE — THE ASSUMPTION THE PER-IP MINUTE CEILING IS SIZED ON.
// Nobody has measured PW's launch traffic yet, so the per-IP minute ceiling
// rests on a stated assumption rather than data, and it is written here so it
// can be argued with instead of reverse-engineered:
//
//     "Campaign push: up to 5 000 users behind one carrier gateway may open
//      the app within the same minute, each landing on a cold cell."
//
// That is the worst legitimate minute we are willing to plan for — a radio
// mention or a push notification hitting one MTN/Vodacom NAT pool at once.
// The first ceiling (1 200/min) failed it: 1 201 distinct installs on distinct
// cold cells produced a 429 for a real user. 6 000/min clears the assumed
// burst with ~20% headroom. If real traffic ever shows a bigger simultaneous
// gateway burst, this number is the one to raise — not the per-install limits,
// which are what actually stop an abuser.
//
//   · weatherMinuteInstall 30/min — nobody legitimately triggers 30 uncached
//     fan-outs in a minute. A real session's opens mostly land on the 5-minute
//     server cache; even a user hammering refresh on a cold cell, or flicking
//     through a dozen favourites, stays well under. This is the burst gate
//     that used to be 240/IP/min and punished the gateway instead of the
//     offender.
//   · weatherMinuteIp 6 000/min — per-IP uncached fan-out burst ceiling, sized
//     directly from the burst profile above (5 000 cold opens in a minute plus
//     headroom). It caps the single-address flood surface without turning a
//     campaign push into an outage for everyone on that gateway.
//   · weatherDailyInstall 300/day — 300 uncached fan-outs is one a minute for
//     five straight hours. A real user opens the app a few dozen times a day
//     and most of those opens never reach this counter, so ordinary use lands
//     one to two orders of magnitude under it.
//   · weatherDailyIp 20 000/day — the CGNAT day ceiling. Sized from the
//     gateway, not the person: ~5 000 subscribers behind one carrier NAT
//     address × ~4 uncached opens each. SA carrier NAT pools sit in that
//     thousands-per-public-IP order of magnitude, and a corporate or campus
//     NAT is far smaller, so no organic gateway reaches it.
//
// REVERSE GEOCODING GETS ITS OWN BUCKETS, NOT A SHARE OF THE FORECAST'S.
// ?reverse=1 is ONE LocationIQ call, not a five-provider fan-out, and it fires
// on a different trigger (first GPS fix, position watch, GPS refresh) than a
// forecast. Making the two share a bucket meant a legitimate gateway burst of
// reverse lookups ate the forecast allowance — 5 000 reverse lookups behind
// one IP left only 1 000 forecasts, so 3 800 of a 5 000-user campaign push
// were rejected. The reverse buckets are therefore separate, at the same
// sizes: the burst profile is the same population of users, and one LocationIQ
// call is strictly cheaper for us than a fan-out, so the ceiling that is safe
// for fan-outs is safe here. Per-install limits stay 30/min and 300/day on
// both paths — a client with a legitimate reason to resolve 30 positions a
// minute does not exist.
// NOTE: LocationIQ has NO entry in provider-budget.js, so unlike the five
// weather sources its quota has no global guard behind these buckets. That is
// why the reverse path is gated at all rather than left to the budget layer.
//
// ALL FOUR ARE ABUSE DAMPENING, NOT QUOTA GUARDS. Provider quota is protected
// DIRECTLY and solely by the global per-provider budget
// (api/_lib/provider-budget.js): 20 000 fan-outs from one IP cannot overrun
// Tomorrow.io's 500/day or Pirate's 600/day, because the budget stops those
// providers at their own ceilings no matter who is asking. Do not re-derive
// these numbers from provider quotas — that was the old weatherDaily rationale
// and it is exactly what provider-budget.js took over.
//
// ACCOUNTING MODEL: ATTEMPTED WORK, NOT COMPLETED WORK (Astra minor 3).
// The buckets are charged at ADMISSION — the moment a request is cleared to do
// uncached upstream work — not after that work completes. So a request that is
// admitted and then finds every provider over its budget (or whose name lookup
// is skipped because a name was supplied) is still charged, having caused zero
// upstream calls. This is deliberate and is the safer of the two models:
// charging only on completed work would let an attacker ride a period of
// budget exhaustion for free, and a request that reaches admission has already
// spent a function invocation and several Redis round trips regardless of what
// the budget then decides. The over-count is bounded by how long a provider
// stays over budget, and it errs toward protecting the app.
// ATOMIC ADMISSION, AND FIXED WINDOWS (Astra round 5, major 2).
// The eight weather/reverse buckets below are NOT @upstash/ratelimit sliding
// windows any more. Admission has to consult four of them at once and the
// answer is all-or-nothing, which four sequential sliding-window charges cannot
// express: when the fourth refused, the first three stayed spent and the caller
// was served a stale response having burned three tokens for zero upstream
// calls. Sliding windows have no refund, so they are enforced instead by
// ./admission.js — ONE Lua EVAL that increments every counter and rolls its own
// increments back the moment any ceiling is exceeded (the same INCR +
// EXPIRE-on-first idiom as api/_lib/provider-budget.js).
//
// The consequence to know about: those eight are FIXED windows, so a boundary
// can admit up to 2x the ceiling across it. Acceptable here precisely because
// these are abuse-dampening numbers with orders of magnitude of headroom (6 000
// /min per IP against a 5 000-user burst) rather than quota guards. The
// geocode/errors/og limiters below keep their sliding windows — single-counter
// checks with no atomicity problem.
export const RATE_LIMITS = {
  // Forecast fan-out. Enforced atomically by ./admission.js (fixed windows).
  weatherMinuteInstall: { max: 30, window: '60 s' },
  weatherMinuteIp:      { max: 6000, window: '60 s' },
  weatherDailyInstall:  { max: 300, window: '1 d' },
  weatherDailyIp:       { max: 20000, window: '1 d' },
  // ?reverse=1 LocationIQ lookup — same sizes, separate counters.
  reverseMinuteInstall: { max: 30, window: '60 s' },
  reverseMinuteIp:      { max: 6000, window: '60 s' },
  reverseDailyInstall:  { max: 300, window: '1 d' },
  reverseDailyIp:       { max: 20000, window: '1 d' },
  geocode: { max: 240, window: '60 s' },
  errors:  { max: 30, window: '60 s' },
  og:      { max: 60, window: '60 s' },
};

// Build the shared Redis client once (memoised across warm Fluid-Compute
// invocations). undefined = not-yet-resolved; null = no config (disabled).
// Exported: api/_lib/weather-cache.js rides the same client/connection.
let _redis;
export function getRedis() {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

const _limiters = {};
function getLimiter(name) {
  if (name in _limiters) return _limiters[name];
  const redis = getRedis();
  const cfg = RATE_LIMITS[name];
  _limiters[name] = redis && cfg
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(cfg.max, cfg.window),
        prefix: `pw-rl:${name}`,
        analytics: false,
      })
    : null;
  return _limiters[name];
}

// NOTE: the eight weather/reverse buckets above have NO Ratelimit instance.
// They are enforced by ./admission.js, which counts them atomically in one Lua
// EVAL — see the ATOMIC ADMISSION note with the table. Only the three
// single-counter endpoint limiters below use @upstash/ratelimit.
export const geocodeLimiter = () => getLimiter('geocode');
export const errorsLimiter = () => getLimiter('errors');
export const ogLimiter = () => getLimiter('og');
