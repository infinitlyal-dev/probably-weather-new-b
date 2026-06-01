// Per-IP rate limiting — pure decision layer. No @upstash import here, so this
// is unit-testable with an injected limiter and never depends on env/Redis.
// The real Upstash-backed limiters live in ./limiters.js.
//
// FAIL-OPEN is the load-bearing property: a rate-limiter outage (Upstash
// unreachable) or a missing config must NEVER block a real request. We would
// rather under-protect for a few minutes during an Upstash incident than take
// the whole app down because the limiter did.

/**
 * Resolve the real client IP behind Vercel's proxy. Vercel sets
 * `x-forwarded-for` as `<client>, <proxy>, …` (client first) and `x-real-ip`
 * to the client IP. We take the FIRST x-forwarded-for entry, then x-real-ip,
 * then a stable default so the limiter key is never undefined.
 */
export function getClientIp(req) {
  const h = req?.headers || {};
  // Prefer x-real-ip: Vercel OVERWRITES it with the real connecting-client IP, so
  // it's a trustworthy single value. x-forwarded-for is APPENDED to, so its
  // leftmost entry can carry a client-supplied (forgeable) prefix — using it as
  // the key would let a script rotate the leftmost value to evade the limit. Fall
  // back to the first XFF entry (non-Vercel / local), then a stable default.
  const xri = h['x-real-ip'];
  if (typeof xri === 'string' && xri.trim()) return xri.trim();
  const xff = h['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return '0.0.0.0';
}

/**
 * Decide whether a request is within its per-IP limit.
 *
 * @param {object} req      the serverless request (for the IP header)
 * @param {{limit:(key:string)=>Promise<{success:boolean}>}|null|undefined} limiter
 *        an Upstash Ratelimit instance, or null/undefined when rate limiting is
 *        disabled (no config). Duck-typed so tests can inject a fake.
 * @returns {Promise<{allowed:boolean, skipped?:string}>}
 *
 * Fail-open: a null limiter, or any error from limiter.limit(), → allowed.
 */
export async function checkRateLimit(req, limiter) {
  if (!limiter) return { allowed: true, skipped: 'disabled' };
  try {
    const { success } = await limiter.limit(getClientIp(req));
    // Block ONLY on an explicit over-limit (success === false). A malformed or
    // partial response (no/undefined success) is treated as allowed — fail open:
    // a rate-limiter malfunction must never 429 a real user.
    return { allowed: success !== false };
  } catch {
    return { allowed: true, skipped: 'error' };
  }
}
