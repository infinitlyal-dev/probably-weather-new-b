// Launch run (2026-09-25): /api/health and the alert that reads it.

import { describe, expect, it } from 'vitest';
import health from '../api/health.js';
import { evaluate, LIMITS } from '../scripts/health-check.mjs';
import { recordSourceFailure, recordServerError, failKey, serverErrorKey } from '../api/_lib/health-counters.js';

const NOW = Date.parse('2026-09-25T10:15:00Z');
const run = async (redis) => {
  let body; const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; }, status() { return this; }, json(b) { body = b; return this; } };
  await health({}, res, { redis, nowMs: NOW });
  return { body, headers };
};
const fakeRedis = (store) => ({ mget: async (...keys) => keys.map((k) => store.get(k) ?? null) });

describe('/api/health', () => {
  it('reads today\'s allowance use, failures and 5xx from counters, cached a minute at the edge', async () => {
    const day = Math.floor(NOW / 86400000);
    const store = new Map([
      [`pw-budget:pirate:d:${day}`, '540'], [`pw-budget:weatherapi:d:${day}`, '12'],
      [failKey('tomorrow', NOW), '7'], [failKey('tomorrow', NOW - 3600000), '5'],
      [serverErrorKey(NOW), '3'],
    ]);
    const { body, headers } = await run(fakeRedis(store));
    expect(headers['Cache-Control']).toBe('s-maxage=60');
    expect(body.ok).toBe(true);
    expect(body.redis).toBe('ok');
    expect(body.today.pirate).toEqual({ used: 540, cap: 600 });
    expect(body.today.weatherapi).toEqual({ used: 12, cap: 3200 });
    expect(body.failuresLastHour.tomorrow).toBe(12);
    expect(body.failuresLastHour['open-meteo']).toBe(0);
    expect(body.serverErrorsLastHour).toBe(3);
  });

  it('says so when Upstash refuses (the free plan used up)', async () => {
    const { body } = await run({ mget: async () => { throw new Error('ERR max requests limit exceeded. Limit: 500000'); } });
    expect(body.ok).toBe(false);
    expect(body.redis).toMatch(/max requests limit exceeded/);
  });
});

describe('the alert rules', () => {
  const healthy = { redis: 'ok', sourcesOff: [], today: { pirate: { used: 10, cap: 600 } }, failuresLastHour: { tomorrow: 0 }, serverErrorsLastHour: 0, openMeteoMonth: { units: 1000, plan: 1_000_000 } };

  it('a healthy reading opens nothing', () => {
    expect(evaluate({ homeStatus: 200, healthStatus: 200, health: healthy })).toEqual([]);
  });

  it('names each problem once, with a stable key', () => {
    const keys = evaluate({ homeStatus: 200, healthStatus: 200, health: {
      ...healthy, redis: 'error: ERR max requests limit exceeded',
      serverErrorsLastHour: LIMITS.serverErrorsPerHour,
      failuresLastHour: { tomorrow: LIMITS.sourceFailuresPerHour, met: 1 },
      today: { pirate: { used: 540, cap: 600 }, weatherapi: { used: 100, cap: 3200 } },
      openMeteoMonth: { units: 800_000, plan: 1_000_000 },
    } }).map((p) => p.key);
    expect(keys).toEqual(['redis', 'server-errors', 'source-tomorrow', 'allowance-pirate', 'open-meteo-month']);
  });

  it('a switched-off source never alerts', () => {
    const p = evaluate({ homeStatus: 200, healthStatus: 200, health: { ...healthy, sourcesOff: ['tomorrow'], failuresLastHour: { tomorrow: 99 }, today: { tomorrow: { used: 500, cap: 500 } } } });
    expect(p).toEqual([]);
  });

  it('the site or the endpoint down', () => {
    expect(evaluate({ homeStatus: 503, healthStatus: 200, health: healthy }).map((p) => p.key)).toEqual(['home-down']);
    expect(evaluate({ homeStatus: null, healthStatus: null, health: null }).map((p) => p.key)).toEqual(['home-down', 'health-down']);
  });
});

describe('health counters are written only on failure, and never throw', () => {
  it('one pipeline per failure, expiring', async () => {
    const calls = [];
    const redis = { pipeline: () => { const p = { incr: (k) => { calls.push(['incr', k]); return p; }, expire: (k, s) => { calls.push(['expire', k, s]); return p; }, exec: async () => [] }; return p; } };
    await recordSourceFailure('Tomorrow.io', { redis, nowMs: NOW, schedule: () => {} });
    await recordServerError({ redis, nowMs: NOW, schedule: () => {} });
    expect(calls).toEqual([['incr', failKey('tomorrow', NOW)], ['expire', failKey('tomorrow', NOW), 7200], ['incr', serverErrorKey(NOW)], ['expire', serverErrorKey(NOW), 7200]]);
  });

  it('a Redis error is swallowed; an unknown source is ignored', async () => {
    const redis = { pipeline: () => { throw new Error('down'); } };
    await expect(recordSourceFailure('Open-Meteo', { redis, schedule: () => {} })).resolves.toBeNull();
    expect(recordSourceFailure('Nobody', { redis, schedule: () => {} })).toBeNull();
  });
});
