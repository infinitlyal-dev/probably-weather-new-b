// ATOMIC, EXACTLY-ONCE admission control for /api/weather's uncached upstream
// work (prelaunch item 1, Astra rounds 5–10).
//
// WHY THIS EXISTS INSTEAD OF @upstash/ratelimit's sliding windows.
// Admission has to consult four counters at once (per-install minute + day,
// per-IP minute + day) and the answer is all-or-nothing: a request either buys
// the right to call upstream or it buys nothing. Four independent sliding
// windows charged in sequence cannot express that — when the fourth refused,
// the first three stayed spent. Sliding windows have no refund, so the fix is
// to never make a partial spend: ONE Lua EVAL that increments every counter
// and, the moment any ceiling is exceeded, decrements everything it
// incremented in that same call.
//
// THE TOKEN, and why flooring at zero was not enough (round 10, major 1).
// A charge can be applied more than once (the Upstash SDK retries a request
// whose reply was lost) and a refund can be issued more than once (a retry, a
// re-entered error path). Counters alone cannot tell those apart: a second
// INCR looks like a second request, and a second DECR silently subtracts
// somebody else's charge. Flooring at zero stops the counter going negative;
// it does NOT establish who owns the decrement.
//
// So every charge carries a per-request token, and the token key is the record
// of what happened:
//   · ADMISSION_SCRIPT, given an existing token, returns the RECORDED outcome
//     and touches no counter — an SDK replay of the same request is a no-op.
//   · It otherwise runs the all-or-nothing logic and writes the outcome plus
//     the exact key list it incremented into the token.
//   · REVERT_SCRIPT refunds only what that token recorded, only once, and only
//     if the token says it was admitted and not yet refunded. A refund can
//     therefore never subtract a charge it did not make.
// Token TTL outlives the longest counter window, so the record cannot expire
// while the counters it describes are still live.
//
// BILLED vs FAIL-OPEN are different states, and only a BILLED request can be
// refunded. Fail-open (no Redis, a lost reply, a timeout) admits the request
// unbilled: nothing was bought, so there is nothing to give back and nothing
// to leak.
//
// THE BILLING RULE:
//   A REQUEST IS CHARGED ONLY IF THE CHARGE COMPLETED, IN TIME, AND THE
//   REQUEST WENT ON TO DO THE UPSTREAM WORK IT PAID FOR.
// Continuations that outlive the response (an abandoned EVAL, and the refund
// that compensates it) are handed to waitUntil, or Vercel may suspend the
// function before they land.
// https://vercel.com/kb/guide/troubleshooting-inconsistent-logs-in-vercel-functions
//
// TRADE-OFF, stated plainly: these buckets are FIXED windows, not sliding ones.
// A fixed window permits up to 2x the ceiling across a boundary. Acceptable for
// abuse dampening sized with orders of magnitude of headroom (RATE_LIMITS in
// ./limiters.js); provider quota, where precision matters, is
// provider-budget.js's job.

import { randomUUID } from 'node:crypto';

import { waitUntil } from '@vercel/functions';

import { getRedis, RATE_LIMITS } from './limiters.js';

/** The four buckets charged for a forecast fan-out. */
export const WEATHER_ADMISSION = [
  'weatherMinuteInstall',
  'weatherDailyInstall',
  'weatherMinuteIp',
  'weatherDailyIp',
];
/** The four charged for a ?reverse=1 LocationIQ lookup — separate counters. */
export const REVERSE_ADMISSION = [
  'reverseMinuteInstall',
  'reverseDailyInstall',
  'reverseMinuteIp',
  'reverseDailyIp',
];

// Window length, and the TTL its counter key carries.
const WINDOWS = {
  '60 s': { ms: 60_000, ttl: 90 },
  '1 d': { ms: 86_400_000, ttl: 90_000 },
};
// Outlives the longest counter window (1 day + slack), so a token can never
// expire while the counters it records are still live and refundable.
export const TOKEN_TTL_SECONDS = 90_000 + 600;

export const tokenKeyFor = (token) => `pw-adm:tok:${token}`;
/** A fresh per-request admission token. */
export const newAdmissionToken = () => randomUUID();

// KEYS[1] = token key, KEYS[2..] = counter keys.
// ARGV[1] = token TTL, then [ceiling, ttl] per counter key.
//
// Replay-safe: an existing token short-circuits to its recorded outcome
// without touching a counter. Otherwise all-or-nothing, and the outcome plus
// the exact keys incremented are recorded in the token.
export const ADMISSION_SCRIPT = `
  local tokenKey = KEYS[1]
  local recorded = redis.call('get', tokenKey)
  if recorded then
    -- '1:<keys>' replays an admission; '0' a refusal; 'r' refunded; 'c' a
    -- CANCELLATION TOMBSTONE written before this command ever ran. Every one
    -- of them answers from the record and increments nothing.
    if string.sub(recorded, 1, 1) == '1' then return 1 end
    return 0
  end
  local tokenTtl = tonumber(ARGV[1])
  local undo = {}
  for i = 2, #KEYS do
    local key = KEYS[i]
    local ceiling = tonumber(ARGV[(i - 2) * 2 + 2])
    local ttl = tonumber(ARGV[(i - 2) * 2 + 3])
    local count = redis.call('incr', key)
    undo[#undo + 1] = key
    if count == 1 then redis.call('expire', key, ttl) end
    if count > ceiling then
      for _, k in ipairs(undo) do redis.call('decr', k) end
      redis.call('set', tokenKey, '0', 'EX', tokenTtl)
      return 0
    end
  end
  redis.call('set', tokenKey, '1:' .. table.concat(undo, '\\n'), 'EX', tokenTtl)
  return 1
`;

// KEYS[1] = token key. Refunds exactly what that token recorded, exactly once.
// An absent token (the charge never applied), a refused charge, or an
// already-refunded token all return 0 and touch nothing — which is what makes
// a double refund harmless and stops a refund subtracting another request's
// charge.
export const REVERT_SCRIPT = `
  local tokenKey = KEYS[1]
  local tokenTtl = tonumber(ARGV[1])
  local recorded = redis.call('get', tokenKey)
  if not recorded then
    -- CANCELLATION BEFORE EXECUTION (round 11, major 1). The charge command is
    -- still in flight — queued behind an SDK retry, or simply slow — so there
    -- is nothing to give back yet. Leave a tombstone instead: when that command
    -- finally reaches Redis it finds 'c' and refuses without incrementing.
    -- Measured without it: compensation found no token at 12.66 s and the
    -- delayed original executed at 13.50 s, keeping all four charges.
    redis.call('set', tokenKey, 'c', 'EX', tokenTtl)
    return 0
  end
  if string.sub(recorded, 1, 1) ~= '1' then return 0 end
  local reverted = 0
  for key in string.gmatch(string.sub(recorded, 3), '[^\\n]+') do
    local current = tonumber(redis.call('get', key))
    if current and current > 0 then
      redis.call('decr', key)
      reverted = reverted + 1
    end
  end
  local ttl = redis.call('ttl', tokenKey)
  if ttl and ttl > 0 then
    redis.call('set', tokenKey, 'r', 'EX', ttl)
  else
    redis.call('set', tokenKey, 'r')
  end
  return reverted
`;

/**
 * Hand a continuation to the platform so the function is not suspended before
 * it lands, and swallow its failure (the response has already gone out).
 */
export function keepAlive(promise, schedule = waitUntil) {
  const settled = Promise.resolve(promise).catch(() => {});
  try {
    schedule(settled);
  } catch {
    // Not running on Vercel (tests, local): nothing to keep alive.
  }
  return settled;
}

/**
 * The counter keys this identity would touch for these buckets.
 *
 * *Install buckets are keyed `${ip}:${installId}` and are SKIPPED when the
 * client sent no well-formed install id; *Ip buckets are keyed on the bare IP.
 * Key: pw-adm:<bucket>:<identity>:<windowBucket>
 */
export function admissionKeys(buckets, { ip, installId }, nowMs = Date.now()) {
  const entries = [];
  for (const name of buckets) {
    const cfg = RATE_LIMITS[name];
    const window = cfg && WINDOWS[cfg.window];
    if (!cfg || !window) continue;
    const perInstall = name.includes('Install');
    if (perInstall && !installId) continue;
    const identity = perInstall ? `${ip}:${installId}` : ip;
    entries.push({
      key: `pw-adm:${name}:${identity}:${Math.floor(nowMs / window.ms)}`,
      ceiling: cfg.max,
      ttl: window.ttl,
    });
  }
  return entries;
}

/**
 * NON-CONSUMING read: is there allowance left in every applicable bucket?
 * @returns {Promise<boolean>} true = admit (also the fail-open answer)
 */
export async function peekAdmission(buckets, identity, redis = getRedis(), nowMs = Date.now()) {
  if (!redis) return true;
  const entries = admissionKeys(buckets, identity, nowMs);
  if (!entries.length) return true;
  try {
    const counts = await redis.mget(...entries.map(e => e.key));
    const list = Array.isArray(counts) ? counts : [counts];
    return entries.every((e, i) => (Number(list[i]) || 0) < e.ceiling);
  } catch {
    return true;
  }
}

// Attempt offsets for a cancellation, in ms from the first try. Six attempts
// over ~32 s — comfortably inside a Vercel function lifetime, and long enough
// to ride out the kind of brief 5xx episode that defeated the old "retry
// once" (round 12, major 1: a 100 ms HTTP 503 burst beat both attempts, Redis
// recovered seconds later, and compensation had already given up, leaving one
// charge in every bucket for a request that made no upstream call).
export const REFUND_BACKOFF_MS = [0, 250, 1000, 3000, 8000, 20000];
// EVERY attempt is bounded. Without this a single stalled EVAL blocked the
// whole chain: measured at 69.2 s one attempt was still hanging, the other
// five never ran, and all four charges survived (round 13, major 1). waitUntil
// keeps the function alive but does not outlive the function's own timeout, so
// an unbounded wait simply burns the lifetime.
export const REFUND_ATTEMPT_TIMEOUT_MS = 2000;
// Worst case for the whole chain, all six attempts stalling:
//   delays 0 + 250 + 1000 + 3000 + 8000 + 20000 = 32.25 s
//   attempts 6 x 2 s                            = 12.00 s
//                                          total ~44.25 s
// Under Vercel's 300 s default, and under a conservative 60 s ceiling too.
// vercel.json sets no maxDuration; if one is added below ~50 s, shorten this
// schedule to match rather than letting the chain be cut off mid-flight.

/**
 * Resolve `promise`, or give up after `ms`. A rejection and a timeout are the
 * same outcome here — both mean "this attempt did not confirm a refund" — and
 * a late reply from a stalled attempt is harmless because the token makes the
 * script idempotent.
 */
function attemptWithTimeout(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).then((value) => ({ ok: true, value }), () => ({ ok: false })),
    new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false }), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Give back the charge recorded under `token` — idempotent by construction,
 * and RECOVERABLE.
 *
 * Every attempt runs the same REVERT_SCRIPT, which is safe to repeat: the
 * token record decides what (if anything) is owed, so a retry after a
 * half-seen failure cannot double-refund. The whole schedule is registered
 * with waitUntil ONCE, so the platform keeps the function alive across the
 * backoff instead of suspending it the moment the response is sent.
 *
 * NEVER awaited on a response path — callers schedule it. Awaiting would put
 * up to 32 s in front of a user who is already being answered.
 *
 * @returns {Promise<number>} counters decremented (0 = nothing owed, or
 *          abandoned after every attempt failed — which is logged, loudly)
 */
export async function refundAdmission(token, redis = getRedis(), { schedule, keys = [] } = {}) {
  if (!redis || !token) return 0;
  const tokenKeys = [tokenKeyFor(token)];
  const argv = [String(TOKEN_TTL_SECONDS)];
  const run = async () => {
    for (const waitMs of REFUND_BACKOFF_MS) {
      // setTimeout, not a busy loop, so fake timers can drive the schedule.
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      // A stalled attempt must never hold up the next one.
      const attempt = await attemptWithTimeout(
        redis.eval(REVERT_SCRIPT, tokenKeys, argv),
        REFUND_ATTEMPT_TIMEOUT_MS,
      );
      if (attempt.ok) return Number(attempt.value) || 0;
      // Failed or timed out: try again on schedule. If the stalled call does
      // eventually land, REVERT_SCRIPT has already been made idempotent by the
      // token, so it is a no-op.
    }
    // Only now is the charge genuinely stranded. It expires with its window,
    // but until then it is billed to someone who never used it.
    console.warn(`[pw-adm] refund abandoned for token ${token}${keys.length ? ` keys=${keys.join(',')}` : ''}`);
    return 0;
  };
  return keepAlive(run(), schedule);
}

/**
 * CHARGE, atomically and exactly once: spend one slot in every applicable
 * bucket, or none.
 *
 * @param {object} [options]
 * @param {string} [options.token] per-request token (generated when absent)
 * @param {() => boolean} [options.abandoned] asked once, after the EVAL comes
 *        back, whether the caller has already given up waiting for it.
 * @param {Function} [options.schedule] waitUntil injection point (tests).
 *
 * @returns {Promise<{allowed: boolean, billed: boolean, token: string|null}>}
 *          allowed — may this request proceed;
 *          billed  — a charge is recorded under `token` and is refundable.
 *          Fail-open paths are allowed-but-unbilled: nothing was bought.
 */
export async function chargeAdmission(buckets, identity, redis = getRedis(), nowMs = Date.now(), { token, abandoned, schedule } = {}) {
  const unbilled = (allowed) => ({ allowed, billed: false, token: null, keys: [] });
  if (!redis) return unbilled(true);
  const entries = admissionKeys(buckets, identity, nowMs);
  if (!entries.length) return unbilled(true);
  const admissionToken = token || newAdmissionToken();
  const keys = [tokenKeyFor(admissionToken), ...entries.map(e => e.key)];
  const argv = [String(TOKEN_TTL_SECONDS), ...entries.flatMap(e => [String(e.ceiling), String(e.ttl)])];
  try {
    const allowed = await redis.eval(ADMISSION_SCRIPT, keys, argv);
    const admitted = allowed === 1 || allowed === '1' || allowed === true;
    if (!admitted) return unbilled(false);
    if (abandoned?.()) {
      // Landed too late to be used. Give it back — scheduled, never awaited.
      refundAdmission(admissionToken, redis, { schedule, keys: entries.map(e => e.key) });
      return unbilled(false);
    }
    return { allowed: true, billed: true, token: admissionToken, keys: entries.map(e => e.key) };
  } catch {
    // LOST REPLY. The EVAL may have applied under this token before the
    // connection failed, so "it errored" is not "it did nothing" — and if the
    // SDK retries it, the token makes that retry a no-op. Refund by token:
    // absent token ⇒ nothing subtracted, applied token ⇒ exactly its own
    // charge given back. Either way the request proceeds UNBILLED.
    refundAdmission(admissionToken, redis, { schedule, keys: entries.map(e => e.key) });
    return unbilled(true);
  }
}
