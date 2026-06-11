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
// New posture: caps sized so no plausible NAT-bucket of real users hits them
// (~40 concurrent active users × ~8 calls in a burst minute), while a
// single-machine hammering script (hundreds/min sustained from one IP without
// NAT-scale diversity) still trips. The sliding window already smooths bursts;
// these are ceilings, not targets — Upstash cost scales with requests, not
// with the cap size.
//   · weather 480 — search minis (~8/search) × NAT concurrency + first-open
//     bursts (weather + reverse + launch refresh). Protects the 5-provider
//     fan-out from scripted quota burn, not from real users.
//   · geocode 240 — search-as-you-type + reverse-geocode bursts.
//   · errors   30 — pure log-spam vector; stays tight (error reporting is
//     client-capped at 10/session, so 30/min/IP is already generous).
export const RATE_LIMITS = {
  weather: { max: 480, window: '60 s' },
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

/** Test-only — reset memoised clients so an env stub takes effect deterministically. */
export function _resetLimiters() {
  _redis = undefined;
  for (const k of Object.keys(_limiters)) delete _limiters[k];
}
