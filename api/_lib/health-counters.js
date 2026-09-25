// Launch run (2026-09-25): the few counters /api/health reports and the launch
// alert (.github/workflows/health.yml) reads. Written ONLY when something goes
// wrong — a provider failing (not a budget skip, not a switched-off source) or
// the forecast answering 5xx — so a healthy request costs no Redis command.
//
// Keys are per UTC hour and expire after two hours:
//   pw-health:fail:<provider>:<hourBucket>   provider ∈ open-meteo, weatherapi, pirate, met, tomorrow
//   pw-health:5xx:<hourBucket>
// Fail-silent: a counter must never turn a forecast into an error.
import { waitUntil } from '@vercel/functions';
import { getRedis } from './limiters.js';

export const HEALTH_TTL_SECONDS = 7200;
const hourBucket = (ms) => Math.floor(ms / 3600000);
export const PROVIDER_IDS = { 'Open-Meteo': 'open-meteo', WeatherAPI: 'weatherapi', 'Pirate Weather': 'pirate', 'MET Norway': 'met', 'Tomorrow.io': 'tomorrow' };
export const failKey = (provider, ms = Date.now()) => `pw-health:fail:${provider}:${hourBucket(ms)}`;
export const serverErrorKey = (ms = Date.now()) => `pw-health:5xx:${hourBucket(ms)}`;

function bump(key, redis, schedule) {
  if (!redis) return null;
  const pending = Promise.resolve()
    .then(() => redis.pipeline().incr(key).expire(key, HEALTH_TTL_SECONDS).exec())
    .catch(() => null);
  try { schedule(pending); } catch { /* outside a request: the promise still runs */ }
  return pending;
}

/** A provider answered with an error or timed out (source name as the handler knows it). */
export function recordSourceFailure(sourceName, { redis = getRedis(), nowMs = Date.now(), schedule = waitUntil } = {}) {
  const id = PROVIDER_IDS[sourceName];
  return id ? bump(failKey(id, nowMs), redis, schedule) : null;
}

/** The forecast endpoint answered 5xx. */
export function recordServerError({ redis = getRedis(), nowMs = Date.now(), schedule = waitUntil } = {}) {
  return bump(serverErrorKey(nowMs), redis, schedule);
}
