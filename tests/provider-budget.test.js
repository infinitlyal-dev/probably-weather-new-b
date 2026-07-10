// HIGH-1 — global per-provider upstream-call budget guard.
//
// Protects each provider's free-tier quota directly (keyed per-provider, not
// per-IP), so a coordinate-varying attacker who misses the cache every request
// still can't run the providers past their ceilings.

import { afterEach, describe, expect, it } from 'vitest';

import {
  PROVIDER_BUDGETS,
  consumeProviderBudgets,
  _resetInstanceBudget,
} from '../api/_lib/provider-budget.js';

// Minimal in-memory fake of the Upstash client surface the guard uses.
function fakeRedis() {
  const store = new Map();
  return {
    store,
    incrCalls: [],
    expireCalls: [],
    evalCalls: [],
    async incr(key) {
      this.incrCalls.push(key);
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return n;
    },
    async decr(key) {
      const n = (store.get(key) ?? 0) - 1;
      store.set(key, n);
      return n;
    },
    async expire(key, ttl) { this.expireCalls.push([key, ttl]); return 1; },
    async eval(script, keys, args) {
      this.evalCalls.push({ script, keys, args });
      for (let i = 0; i < keys.length; i++) {
        const ceiling = Number(args[i * 3]);
        const ttl = Number(args[i * 3 + 1]);
        const revert = Number(args[i * 3 + 2]);
        const key = keys[i];
        const count = await this.incr(key);
        if (count === 1) await this.expire(key, ttl);
        if (count > ceiling) {
          if (revert === 1) await this.decr(key);
          return 0;
        }
      }
      return 1;
    },
  };
}

const NOW = 1_750_000_000_000; // fixed clock so minute/day buckets are stable

afterEach(() => _resetInstanceBudget());

describe('PROVIDER_BUDGETS — Pirate is the binding monthly tier', () => {
  it('caps Pirate per-day below the 20k/month free tier with margin', () => {
    expect(PROVIDER_BUDGETS.pirate.perDay).toBe(600);
    // 600/day × 31 days = 18,600 < 20,000 — exhaustion is structurally impossible.
    expect(PROVIDER_BUDGETS.pirate.perDay * 31).toBeLessThan(20000);
    // per-minute burst cap is small (was effectively 480/min/IP unbounded).
    expect(PROVIDER_BUDGETS.pirate.perMin).toBe(20);
  });
});

describe('PROVIDER_BUDGETS — Tomorrow.io published free-tier windows', () => {
  it('S1 enforces Tomorrow.io at 3/second, 25/hour and 500/day', async () => {
    expect(PROVIDER_BUDGETS.tomorrow).toEqual({ perSecond: 3, perHour: 25, perDay: 500 });

    const redis = fakeRedis();
    const hourKey = `pw-budget:tomorrow:h:${Math.floor(NOW / 3600000)}`;
    redis.store.set(hourKey, PROVIDER_BUDGETS.tomorrow.perHour);
    const res = await consumeProviderBudgets(['tomorrow'], redis, NOW);

    expect(res.tomorrow).toBe(false);
  });
});

describe('consumeProviderBudgets — enforcement before fetch', () => {
  it('P5 consumes every configured window in one atomic Redis round trip per provider', async () => {
    const redis = {
      evalCalls: [],
      async eval(script, keys, args) {
        this.evalCalls.push({ script, keys, args });
        return 1;
      },
      async incr() { throw new Error('non-atomic counter command used'); },
    };

    const providers = ['open-meteo', 'weatherapi', 'pirate', 'met', 'tomorrow'];
    const result = await consumeProviderBudgets(providers, redis, NOW);

    expect(Object.values(result).every(Boolean)).toBe(true);
    expect(redis.evalCalls).toHaveLength(providers.length);
  });

  it('allows providers under ceiling and consumes one slot each', async () => {
    const redis = fakeRedis();
    const res = await consumeProviderBudgets(['open-meteo', 'pirate'], redis, NOW);
    expect(res).toEqual({ 'open-meteo': true, pirate: true });
    // Pirate has perDay + perMin → two windows incremented; OM likewise.
    expect(redis.incrCalls).toContain(`pw-budget:pirate:d:${Math.floor(NOW / 86400000)}`);
    expect(redis.incrCalls).toContain(`pw-budget:pirate:m:${Math.floor(NOW / 60000)}`);
  });

  it('blocks a provider once its per-minute ceiling is reached, in isolation', async () => {
    const redis = fakeRedis();
    let lastPirate;
    for (let i = 0; i < PROVIDER_BUDGETS.pirate.perMin + 5; i++) {
      lastPirate = (await consumeProviderBudgets(['pirate'], redis, NOW)).pirate;
    }
    expect(lastPirate).toBe(false); // pirate exhausted
    // Per-provider isolation: a DIFFERENT provider in the same window is fine.
    const om = await consumeProviderBudgets(['open-meteo'], redis, NOW);
    expect(om['open-meteo']).toBe(true);
  });

  it('blocks on the per-DAY ceiling even when the minute window is fresh', async () => {
    const redis = fakeRedis();
    // Pre-load the day counter to its cap; minute counter untouched.
    redis.store.set(`pw-budget:pirate:d:${Math.floor(NOW / 86400000)}`, PROVIDER_BUDGETS.pirate.perDay);
    const res = await consumeProviderBudgets(['pirate'], redis, NOW);
    expect(res.pirate).toBe(false);
  });

  // Codex DoS — minute-capped rejected attempts must NOT advance the day
  // counter, or cheap floods lock a provider out for the whole UTC day.
  it('minute-capped rejected attempts do NOT advance the day counter (no self-DoS)', async () => {
    const redis = fakeRedis();
    const dayKey = `pw-budget:pirate:d:${Math.floor(NOW / 86400000)}`;
    // Far more attempts than the minute cap, all in the SAME minute.
    for (let i = 0; i < 600; i++) await consumeProviderBudgets(['pirate'], redis, NOW);
    // Only the minute-ALLOWED attempts (perMin = 20) consumed a day slot —
    // not all 600. Old behaviour drained the day to 600 and locked it.
    expect(redis.store.get(dayKey)).toBe(PROVIDER_BUDGETS.pirate.perMin);
    expect(redis.store.get(dayKey)).toBeLessThan(PROVIDER_BUDGETS.pirate.perDay);
    // Proof it's not locked: the NEXT minute, pirate is allowed again.
    expect((await consumeProviderBudgets(['pirate'], redis, NOW + 60000)).pirate).toBe(true);
  });

  it('a day-rejected (minute-ok) attempt reverts its day increment (never spends a slot it cannot use)', async () => {
    const redis = fakeRedis();
    const dayKey = `pw-budget:tomorrow:d:${Math.floor(NOW / 86400000)}`;
    redis.store.set(dayKey, PROVIDER_BUDGETS.tomorrow.perDay); // day already at cap
    const res = await consumeProviderBudgets(['tomorrow'], redis, NOW);
    expect(res.tomorrow).toBe(false);
    // The increment was reverted — counter stays at cap, not cap+1.
    expect(redis.store.get(dayKey)).toBe(PROVIDER_BUDGETS.tomorrow.perDay);
  });

  it('an exhausted provider is skipped while the rest proceed (all-but-one)', async () => {
    const redis = fakeRedis();
    // Exhaust only Tomorrow.io's official hourly window.
    redis.store.set(`pw-budget:tomorrow:h:${Math.floor(NOW / 3600000)}`, PROVIDER_BUDGETS.tomorrow.perHour);
    const res = await consumeProviderBudgets(['open-meteo', 'weatherapi', 'pirate', 'met', 'tomorrow'], redis, NOW);
    expect(res.tomorrow).toBe(false);
    expect(res['open-meteo']).toBe(true);
    expect(res.weatherapi).toBe(true);
    expect(res.pirate).toBe(true);
    expect(res.met).toBe(true);
  });

  it('all providers exhausted → every flag false (caller serves cache/stale/503)', async () => {
    const redis = fakeRedis();
    const mb = Math.floor(NOW / 60000);
    for (const p of ['open-meteo', 'weatherapi', 'pirate', 'met', 'tomorrow']) {
      if (Number.isFinite(PROVIDER_BUDGETS[p].perMin)) {
        redis.store.set(`pw-budget:${p}:m:${mb}`, PROVIDER_BUDGETS[p].perMin);
      } else {
        redis.store.set(`pw-budget:${p}:h:${Math.floor(NOW / 3600000)}`, PROVIDER_BUDGETS[p].perHour);
      }
    }
    const res = await consumeProviderBudgets(['open-meteo', 'weatherapi', 'pirate', 'met', 'tomorrow'], redis, NOW);
    expect(Object.values(res).every((v) => v === false)).toBe(true);
  });
});

describe('fail-open on availability — Redis unreachable', () => {
  it('null client → conservative per-instance ceiling, NOT unlimited', async () => {
    // Pirate instance fallback is 5/min. The 6th call in the same minute blocks.
    let last;
    for (let i = 0; i < 8; i++) {
      last = (await consumeProviderBudgets(['pirate'], null, NOW)).pirate;
    }
    expect(last).toBe(false);
  });

  it('a throwing Redis routes that provider through the instance fallback', async () => {
    const broken = {
      async incr() { throw new Error('redis down'); },
      async expire() { throw new Error('redis down'); },
    };
    // First few allowed (instance ceiling), never throws.
    const res = await consumeProviderBudgets(['open-meteo'], broken, NOW);
    expect(typeof res['open-meteo']).toBe('boolean');
    expect(res['open-meteo']).toBe(true);
  });

  it('S1 Redis-down Tomorrow fallback still enforces three requests per second', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push((await consumeProviderBudgets(['tomorrow'], null, NOW)).tomorrow);
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it('instance fallback isolates per provider and resets between minutes', async () => {
    // Exhaust pirate (5/min) in minute N; tomorrow (5/min) still fine same minute.
    for (let i = 0; i < 6; i++) await consumeProviderBudgets(['pirate'], null, NOW);
    expect((await consumeProviderBudgets(['pirate'], null, NOW)).pirate).toBe(false);
    expect((await consumeProviderBudgets(['tomorrow'], null, NOW)).tomorrow).toBe(true);
    // Next minute → pirate fresh again.
    expect((await consumeProviderBudgets(['pirate'], null, NOW + 60000)).pirate).toBe(true);
  });
});

describe('unbudgeted provider never blocks', () => {
  it('a provider with no PROVIDER_BUDGETS entry is always allowed', async () => {
    const redis = fakeRedis();
    const res = await consumeProviderBudgets(['mystery-source'], redis, NOW);
    expect(res['mystery-source']).toBe(true);
  });
});
