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

// Per-IP per-minute caps (sliding window). Sized so a real user never hits them
// (60/min = 1 req/s sustained, which no human holds) but a hammering script
// trips instantly:
//   · weather 60 — bursty legit usage (miniFetchTemp fires one /api/weather per
//     search result, ~8/search, cached) needs headroom, and it protects the
//     5-provider fan-out from quota burn.
//   · geocode 60 — search-as-you-type + reverse-geocode bursts.
//   · errors  30 — pure log-spam vector (errors.js flagged this as the deferred
//     complement to origin-gating); kept tightest.
export const RATE_LIMITS = {
  weather: { max: 60, window: '60 s' },
  geocode: { max: 60, window: '60 s' },
  errors:  { max: 30, window: '60 s' },
};

// Build the shared Redis client once (memoised across warm Fluid-Compute
// invocations). undefined = not-yet-resolved; null = no config (disabled).
let _redis;
function getRedis() {
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

/** Test-only — reset memoised clients so an env stub takes effect deterministically. */
export function _resetLimiters() {
  _redis = undefined;
  for (const k of Object.keys(_limiters)) delete _limiters[k];
}
