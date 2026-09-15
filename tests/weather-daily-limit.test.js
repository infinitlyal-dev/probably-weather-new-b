import { describe, expect, it } from 'vitest';

import { RATE_LIMITS } from '../api/_lib/limiters.js';
import { admissionKeys, REVERSE_ADMISSION, WEATHER_ADMISSION } from '../api/_lib/admission.js';

// Prelaunch item 1 (2026-09-14) replaced the flat per-IP weather caps with two
// allowance families (forecast fan-out, ?reverse=1 lookup), each on two axes —
// key (install vs IP) × window (minute vs day) — all charged only for UNCACHED
// upstream work. Behaviour is pinned in tests/shared-ip-daily-limit.test.js;
// this file pins the table itself.
describe('weather limiter configuration', () => {
  it('S1 meters a single install at 30 uncached fan-outs/min and 300/day', () => {
    expect(RATE_LIMITS.weatherMinuteInstall).toEqual({ max: 30, window: '60 s' });
    expect(RATE_LIMITS.weatherDailyInstall).toEqual({ max: 300, window: '1 d' });
  });

  it('S2 backs those with CGNAT-sized per-IP ceilings: 6 000/min and 20 000/day', () => {
    expect(RATE_LIMITS.weatherMinuteIp).toEqual({ max: 6000, window: '60 s' });
    expect(RATE_LIMITS.weatherDailyIp).toEqual({ max: 20000, window: '1 d' });
    // The minute ceiling must clear the documented burst profile: up to 5 000
    // users behind one carrier gateway opening within the same minute.
    expect(RATE_LIMITS.weatherMinuteIp.max).toBeGreaterThan(5000);
    // Gateway ceilings stay far above the per-install allowances, or the
    // shared-IP lockout this item fixed comes back at a bigger number.
    expect(RATE_LIMITS.weatherMinuteIp.max).toBeGreaterThan(RATE_LIMITS.weatherMinuteInstall.max * 10);
    expect(RATE_LIMITS.weatherDailyIp.max).toBeGreaterThan(RATE_LIMITS.weatherDailyInstall.max * 10);
  });

  it('S3 ?reverse=1 has its own family at the same sizes, so the two never compete', () => {
    expect(RATE_LIMITS.reverseMinuteInstall).toEqual(RATE_LIMITS.weatherMinuteInstall);
    expect(RATE_LIMITS.reverseDailyInstall).toEqual(RATE_LIMITS.weatherDailyInstall);
    expect(RATE_LIMITS.reverseMinuteIp).toEqual(RATE_LIMITS.weatherMinuteIp);
    expect(RATE_LIMITS.reverseDailyIp).toEqual(RATE_LIMITS.weatherDailyIp);
  });

  it('S4 the old flat per-IP weather buckets are gone', () => {
    expect(RATE_LIMITS.weather).toBeUndefined();
    expect(RATE_LIMITS.weatherDaily).toBeUndefined();
  });

  it('S5 the eight admission buckets have no @upstash/ratelimit instance', async () => {
    // They are counted atomically by _lib/admission.js instead (round 5), so
    // limiters.js must NOT still be handing out Ratelimit objects for them —
    // two enforcement paths for one number is how they drift apart.
    const limiters = await import('../api/_lib/limiters.js');
    for (const name of [...WEATHER_ADMISSION, ...REVERSE_ADMISSION]) {
      expect(limiters[`${name}Limiter`]).toBeUndefined();
    }
    // The three single-counter endpoint limiters are untouched.
    expect(typeof limiters.geocodeLimiter).toBe('function');
    expect(typeof limiters.errorsLimiter).toBe('function');
    expect(typeof limiters.ogLimiter).toBe('function');
  });

  it('S6 every admission bucket uses a window admission.js knows how to count', () => {
    for (const name of [...WEATHER_ADMISSION, ...REVERSE_ADMISSION]) {
      const cfg = RATE_LIMITS[name];
      expect(cfg, `${name} missing from RATE_LIMITS`).toBeTruthy();
      // A window admission.js cannot map would silently drop that bucket.
      expect(admissionKeys([name], { ip: '1.2.3.4', installId: 'abcdefgh' })).toHaveLength(1);
    }
  });
});
