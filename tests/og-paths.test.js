// Tests for OG (share-card) path helpers in assets/weather-visuals.js.
//
// These cover the new 4-week WebP structure that the /api/og renderer reads
// from. The picker (assets/image-picker.js) is randomised and per-user; OG is
// deterministic (one canonical image per condition+time) and always week_1.

import { describe, expect, it } from 'vitest';
import {
  WEATHER_BACKGROUND_ALIASES,
  getOgBackgroundFallbackChain,
  getOgBackgroundPath,
  getTimeOfDaySlot,
  getWeatherBackgroundFallbackFolder,
  getWeatherBackgroundFolder,
} from '../assets/weather-visuals.js';

const CONDITIONS = ['clear', 'cloudy', 'cold', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const ALIAS_CONDITIONS = Object.keys(WEATHER_BACKGROUND_ALIASES);

describe('getOgBackgroundPath', () => {
  it('returns the canonical week_1 WebP path for clear/day', () => {
    expect(getOgBackgroundPath('clear', 'day')).toBe('assets/images/bg/clear/week_1/day/1.webp');
  });

  it('always references /week_1/ regardless of input', () => {
    for (const c of CONDITIONS) {
      for (const t of TIMES) {
        expect(getOgBackgroundPath(c, t)).toMatch(/\/week_1\//);
      }
    }
  });

  it('always ends in .webp (never .jpg) for known conditions', () => {
    for (const c of CONDITIONS) {
      for (const t of TIMES) {
        expect(getOgBackgroundPath(c, t)).toMatch(/\.webp$/);
      }
    }
  });

  it('produces all 32 (8 × 4) canonical paths in the expected shape', () => {
    const pattern = /^assets\/images\/bg\/[a-z-]+\/week_1\/(dawn|day|dusk|night)\/1\.webp$/;
    let combos = 0;
    for (const c of CONDITIONS) {
      for (const t of TIMES) {
        combos += 1;
        expect(getOgBackgroundPath(c, t)).toMatch(pattern);
      }
    }
    expect(combos).toBe(32);
  });

  it('defaults timeOfDay to "day" when omitted (back-compat with old callers)', () => {
    expect(getOgBackgroundPath('storm')).toBe('assets/images/bg/storm/week_1/day/1.webp');
    expect(getOgBackgroundPath('rain')).toBe('assets/images/bg/rain/week_1/day/1.webp');
  });

  it('falls back to "day" when timeOfDay is unrecognised', () => {
    expect(getOgBackgroundPath('clear', 'twilight')).toBe('assets/images/bg/clear/week_1/day/1.webp');
    expect(getOgBackgroundPath('clear', '')).toBe('assets/images/bg/clear/week_1/day/1.webp');
    expect(getOgBackgroundPath('clear', null)).toBe('assets/images/bg/clear/week_1/day/1.webp');
  });

  it('resolves aliases through getWeatherBackgroundFolder', () => {
    // rain-possible → cloudy, uv → clear, hail → storm, thunder → storm, partly-cloudy → cloudy
    for (const alias of ALIAS_CONDITIONS) {
      const resolved = WEATHER_BACKGROUND_ALIASES[alias];
      expect(getOgBackgroundPath(alias, 'day')).toBe(`assets/images/bg/${resolved}/week_1/day/1.webp`);
    }
  });

  it('falls through to "clear" for empty / null / undefined condition', () => {
    expect(getOgBackgroundPath('', 'day')).toBe('assets/images/bg/clear/week_1/day/1.webp');
    expect(getOgBackgroundPath(null, 'day')).toBe('assets/images/bg/clear/week_1/day/1.webp');
    expect(getOgBackgroundPath(undefined, 'day')).toBe('assets/images/bg/clear/week_1/day/1.webp');
  });

  it('handles cold-clear without URL encoding the hyphen', () => {
    expect(getOgBackgroundPath('cold-clear', 'dawn')).toBe('assets/images/bg/cold-clear/week_1/dawn/1.webp');
  });
});

describe('getOgBackgroundFallbackChain', () => {
  it('returns a 4-step chain for storm/dusk (no collapse)', () => {
    const c = getOgBackgroundFallbackChain('storm', 'dusk');
    expect(c).toEqual([
      'assets/images/bg/storm/week_1/dusk/1.webp',
      'assets/images/bg/storm/week_1/day/1.webp',
      'assets/images/bg/clear/week_1/day/1.webp',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('dedupes when timeOfDay is already "day" (steps 1 + 2 collapse)', () => {
    const c = getOgBackgroundFallbackChain('storm', 'day');
    expect(c).toEqual([
      'assets/images/bg/storm/week_1/day/1.webp',
      'assets/images/bg/clear/week_1/day/1.webp',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('dedupes worst case — clear + day collapses to 2 entries', () => {
    const c = getOgBackgroundFallbackChain('clear', 'day');
    expect(c).toEqual([
      'assets/images/bg/clear/week_1/day/1.webp',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('last entry is always default.jpg (final guard)', () => {
    for (const cond of CONDITIONS) {
      for (const t of TIMES) {
        const chain = getOgBackgroundFallbackChain(cond, t);
        expect(chain[chain.length - 1]).toBe('assets/images/bg/default.jpg');
      }
    }
  });

  it('produces no .jpg paths except the default.jpg guard', () => {
    const c = getOgBackgroundFallbackChain('rain', 'night');
    const jpgCount = c.filter((p) => p.endsWith('.jpg')).length;
    expect(jpgCount).toBe(1);
    expect(c[c.length - 1]).toBe('assets/images/bg/default.jpg');
  });

  it('all chain entries are unique', () => {
    for (const cond of CONDITIONS) {
      for (const t of TIMES) {
        const chain = getOgBackgroundFallbackChain(cond, t);
        expect(new Set(chain).size).toBe(chain.length);
      }
    }
  });
});

describe('getTimeOfDaySlot', () => {
  // 2026-05-26 in SAST (UTC+2). At 14:00 SAST that's UTC 12:00.
  // Sunrise around 07:00, sunset around 17:30 (typical SA winter values).
  const baseSastPayload = {
    now: { sunrise: '2026-05-26T07:00', sunset: '2026-05-26T17:30' },
    meta: { utcOffsetSeconds: 7200, localHour: 14 },
  };

  it('returns "day" mid-afternoon in SAST', () => {
    const nowMs = Date.UTC(2026, 4, 26, 12, 0, 0); // 14:00 SAST
    expect(getTimeOfDaySlot(baseSastPayload, nowMs)).toBe('day');
  });

  it('returns "dawn" 15min after sunrise', () => {
    const nowMs = Date.UTC(2026, 4, 26, 5, 15, 0); // 07:15 SAST
    expect(getTimeOfDaySlot(baseSastPayload, nowMs)).toBe('dawn');
  });

  it('returns "dusk" 30min before sunset', () => {
    const nowMs = Date.UTC(2026, 4, 26, 15, 0, 0); // 17:00 SAST (30 min pre-sunset)
    expect(getTimeOfDaySlot(baseSastPayload, nowMs)).toBe('dusk');
  });

  it('returns "night" at 22:00 local', () => {
    const nowMs = Date.UTC(2026, 4, 26, 20, 0, 0); // 22:00 SAST
    expect(getTimeOfDaySlot(baseSastPayload, nowMs)).toBe('night');
  });

  it('returns "night" pre-dawn at 03:00 local', () => {
    const nowMs = Date.UTC(2026, 4, 26, 1, 0, 0); // 03:00 SAST
    expect(getTimeOfDaySlot(baseSastPayload, nowMs)).toBe('night');
  });

  it('falls back to localHour buckets when sunrise/sunset missing', () => {
    const noSolar = { now: {}, meta: { localHour: 6 } };
    expect(getTimeOfDaySlot(noSolar)).toBe('dawn'); // 5-8 → dawn

    expect(getTimeOfDaySlot({ now: {}, meta: { localHour: 12 } })).toBe('day');
    expect(getTimeOfDaySlot({ now: {}, meta: { localHour: 18 } })).toBe('dusk');
    expect(getTimeOfDaySlot({ now: {}, meta: { localHour: 23 } })).toBe('night');
    expect(getTimeOfDaySlot({ now: {}, meta: { localHour: 0 } })).toBe('night');
  });

  it('defaults to "day" when no signal at all', () => {
    expect(getTimeOfDaySlot({})).toBe('day');
    expect(getTimeOfDaySlot(null)).toBe('day');
    expect(getTimeOfDaySlot(undefined)).toBe('day');
    expect(getTimeOfDaySlot({ now: {}, meta: {} })).toBe('day');
  });

  it('returns a value in the valid set for any input shape', () => {
    const valid = new Set(['dawn', 'day', 'dusk', 'night']);
    expect(valid.has(getTimeOfDaySlot({}))).toBe(true);
    expect(valid.has(getTimeOfDaySlot(baseSastPayload))).toBe(true);
    expect(valid.has(getTimeOfDaySlot({ now: { sunrise: 'garbage', sunset: null }, meta: {} }))).toBe(true);
  });
});

describe('back-compat surface', () => {
  it('still exports getWeatherBackgroundFolder', () => {
    expect(typeof getWeatherBackgroundFolder).toBe('function');
    expect(getWeatherBackgroundFolder('rain-possible')).toBe('cloudy');
  });

  it('still exports getWeatherBackgroundFallbackFolder', () => {
    expect(typeof getWeatherBackgroundFallbackFolder).toBe('function');
    expect(getWeatherBackgroundFallbackFolder('cold')).toBe('cloudy');
    expect(getWeatherBackgroundFallbackFolder('rain')).toBe('clear');
  });
});
