// Upstash-backed per-IP limiters. Isolated from the pure decision layer
// (./rate-limit.js) so the @upstash import only loads on the server path.
//
// Env: the Vercel↔Upstash integration provisions KV-FLAVOUR names —
//   UPSTASH_KV_REST_API_URL + UPSTASH_KV_REST_API_TOKEN
// (NOT the bare UPSTASH_REDIS_REST_URL/TOKEN). When either is absent we return
// null → checkRateLimit() fails open (rate limiting disabled), so local runs,
// tests, and a mis-provisioned deploy never crash or block requests.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Per-IP per-minute caps (sliding window).
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
// weather 480 → 240. Rationale: with quota protection moved to the provider
// budget, the cap can stay CGNAT-generous without the quota risk that made 480
// dangerous — but 480 was set to defend quota it no longer defends, so trim it
// to match geocode. 240/min ≈ 4 req/s sustained per IP comfortably covers a
// busy carrier-NAT bucket (search-mini bursts of ~8/search × concurrent users,
// most now served from the server cache anyway) while halving the single-IP
// flood surface vs 480. The sliding window smooths bursts; these are ceilings,
// not targets.
//   · weather 240 — abuse-dampening only (quota is the provider budget's job).
//   · geocode 240 — search-as-you-type + reverse-geocode bursts.
//   · errors   30 — pure log-spam vector; stays tight (error reporting is
//     client-capped at 10/session, so 30/min/IP is already generous).
export const RATE_LIMITS = {
  weather: { max: 240, window: '60 s' },
  geocode: { max: 240, window: '60 s' },
  errors:  { max: 30, window: '60 s' },
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

export const weatherLimiter = () => getLimiter('weather');
export const geocodeLimiter = () => getLimiter('geocode');
export const errorsLimiter = () => getLimiter('errors');
