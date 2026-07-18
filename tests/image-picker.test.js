// Unit tests for assets/image-picker.js.
// Pure-function module — no DOM, no jsdom needed.
//
// Anchor: LAUNCH_DATE_MS = Saturday 30 May 2026 00:00 SAST = Friday 29 May 22:00 UTC.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAUNCH_DATE_MS,
  WEEK_MS,
  getRotationWeek,
  buildPickerPaths,
  pickRandomIndex,
  _resetWarnedFolders,
} from '../assets/image-picker.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('LAUNCH_DATE_MS sanity', () => {
  it('resolves to Friday 29 May 2026 at 22:00 UTC (= SAST Saturday 00:00)', () => {
    const d = new Date(LAUNCH_DATE_MS);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4); // May
    expect(d.getUTCDate()).toBe(29);
    expect(d.getUTCHours()).toBe(22);
    expect(d.getUTCMinutes()).toBe(0);
    // 5 = Friday (UTC), which is Saturday in SAST.
    expect(d.getUTCDay()).toBe(5);
  });

  it('represents Saturday in SAST — UTC arithmetic (ICU-independent)', () => {
    // ICU-independent intent proof: SAST = UTC + 2h. Add the offset, then read
    // UTC day-of-week — Saturday's UTC day-index is 6. This survives Node
    // builds without full-ICU data, where the Intl assertion below might fail.
    const sastMidnight = new Date(LAUNCH_DATE_MS + 2 * 60 * 60 * 1000);
    expect(sastMidnight.getUTCDay()).toBe(6); // Saturday
    expect(sastMidnight.getUTCDate()).toBe(30);
    expect(sastMidnight.getUTCMonth()).toBe(4); // May
    expect(sastMidnight.getUTCFullYear()).toBe(2026);
    expect(sastMidnight.getUTCHours()).toBe(0); // midnight
  });

  it('represents Saturday in SAST — Intl formatter (full-ICU only)', () => {
    // Belt-and-braces — this version proves the formatter agrees with the
    // arithmetic version above. On a small-icu Node build (no Africa/Johannesburg
    // data) the formatter may fall back to GMT; the arithmetic test will still
    // catch any anchor regression, so failure here is informational not fatal.
    const fmt = new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const parts = fmt.formatToParts(new Date(LAUNCH_DATE_MS));
    const get = (type) => parts.find((p) => p.type === type)?.value;
    expect(get('weekday')).toBe('Saturday');
    expect(get('day')).toBe('30');
    expect(get('month')).toBe('May');
    expect(get('year')).toBe('2026');
  });
});

describe('getRotationWeek', () => {
  it('returns 1 exactly at launch instant', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS)).toBe(1);
  });

  it('stays at 1 through the first 6 days', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS + 6 * DAY_MS)).toBe(1);
  });

  it('flips to 2 at launch + 7 days', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS + 7 * DAY_MS)).toBe(2);
  });

  it('flips to 3 at launch + 14 days', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS + 14 * DAY_MS)).toBe(3);
  });

  it('flips to 4 at launch + 21 days', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS + 21 * DAY_MS)).toBe(4);
  });

  it('wraps to 1 at launch + 28 days (cycle restart)', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS + 28 * DAY_MS)).toBe(1);
  });

  it('continues cycling correctly through year 2', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS + 52 * 7 * DAY_MS)).toBe(1); // 52 weeks = 13 cycles
    expect(getRotationWeek(LAUNCH_DATE_MS + 53 * 7 * DAY_MS)).toBe(2);
  });

  it('returns 1 for the millisecond before launch', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS - 1)).toBe(1);
  });

  it('returns 1 for arbitrary historical dates', () => {
    expect(getRotationWeek(LAUNCH_DATE_MS - 100 * WEEK_MS)).toBe(1);
    expect(getRotationWeek(0)).toBe(1);
    expect(getRotationWeek(Date.UTC(2025, 0, 1))).toBe(1);
  });

  it('returns a valid 1-4 for far-future dates (2030, 2040)', () => {
    const y2030 = Date.UTC(2030, 0, 1);
    const y2040 = Date.UTC(2040, 0, 1);
    expect([1, 2, 3, 4]).toContain(getRotationWeek(y2030));
    expect([1, 2, 3, 4]).toContain(getRotationWeek(y2040));
  });

  it('handles NaN / non-finite gracefully', () => {
    expect(getRotationWeek(NaN)).toBe(1);
    expect(getRotationWeek(Infinity)).toBe(1);
    expect(getRotationWeek(-Infinity)).toBe(1);
    // `undefined` is NOT a non-finite input — it triggers the default param
    // (nowMs = Date.now()) and returns the CURRENT rotation week. Asserting
    // toBe(1) here made the test date-dependent: it passed during week_1 and
    // started failing the day the rotation entered week_2 (2026-06-06).
    expect(getRotationWeek(undefined)).toBe(getRotationWeek(Date.now()));
    expect([1, 2, 3, 4]).toContain(getRotationWeek(undefined));
  });

  it('flips on the exact week boundary, not 1ms earlier', () => {
    // 1ms before week_2 starts → still week 1
    expect(getRotationWeek(LAUNCH_DATE_MS + 7 * DAY_MS - 1)).toBe(1);
    // exactly at week_2 start → week 2
    expect(getRotationWeek(LAUNCH_DATE_MS + 7 * DAY_MS)).toBe(2);
  });

  it('SAST Saturday 23:59 vs Sunday 00:01 return different weeks at every boundary', () => {
    // Saturday 23:59 SAST = Saturday 21:59 UTC. The launch boundary is
    // Friday 22:00 UTC = Saturday 00:00 SAST, so this is mid-week, not
    // adjacent to a boundary. The actual boundary the picker cares about
    // is Saturday 00:00 SAST = Friday 22:00 UTC.
    // Spec test: a sample near the week_2/week_3 boundary (launch + 14d).
    const boundary = LAUNCH_DATE_MS + 14 * DAY_MS;
    expect(getRotationWeek(boundary - 60 * 1000)).toBe(2); // 1 min before
    expect(getRotationWeek(boundary + 60 * 1000)).toBe(3); // 1 min after
  });

  it('defaults to Date.now() when called with no argument', () => {
    // Just confirms the default param wires up — return value must be 1..4.
    const result = getRotationWeek();
    expect([1, 2, 3, 4]).toContain(result);
  });
});

describe('buildPickerPaths', () => {
  it('P1 versions every rotating WebP URL while leaving the JPG guard stable', () => {
    const paths = buildPickerPaths('cold', 'cloudy', 'night', 2, 5);
    expect(paths.slice(0, -1).every((url) => url.endsWith('?v=20260718-p1'))).toBe(true);
    expect(paths.at(-1)).toBe('assets/images/bg/default.jpg');
  });

  it('builds a deduped chain — clear/day/week_1/r=3 drops a redundant step', () => {
    // For clear/clear, step 2 (week_1 collapse) and step 3 (sibling collapse)
    // produce the same path, so the deduper merges them.
    const c = buildPickerPaths('clear', 'clear', 'day', 1, 3);
    expect(c).toEqual([
      'assets/images/bg/clear/week_1/day/3.webp?v=20260718-p1',
      'assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('uses cloudy as sibling fallback for cold (full 4-step chain — no collapse)', () => {
    const c = buildPickerPaths('cold', 'cloudy', 'night', 2, 5);
    expect(c).toEqual([
      'assets/images/bg/cold/week_2/night/5.webp?v=20260718-p1',
      'assets/images/bg/cold/week_1/night/1.webp?v=20260718-p1',
      'assets/images/bg/cloudy/week_1/night/1.webp?v=20260718-p1',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('dedupes when r=1 collapses primary into week_1 fallback', () => {
    const c = buildPickerPaths('cold', 'cloudy', 'day', 1, 1);
    // primary = cold/week_1/day/1.webp == step 2 → dedupes
    expect(c).toEqual([
      'assets/images/bg/cold/week_1/day/1.webp?v=20260718-p1',
      'assets/images/bg/cloudy/week_1/day/1.webp?v=20260718-p1',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('dedupes worst-case r=1 with folder == fallbackFolder → just 2 entries', () => {
    const c = buildPickerPaths('clear', 'clear', 'day', 1, 1);
    expect(c).toEqual([
      'assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('handles cold-clear without URL encoding the hyphen', () => {
    const c = buildPickerPaths('cold-clear', 'clear', 'dawn', 4, 7);
    expect(c[0]).toBe('assets/images/bg/cold-clear/week_4/dawn/7.webp?v=20260718-p1');
    expect(c[0]).not.toMatch(/%/);
  });

  it('produces valid paths for all 9 conditions × 4 weeks × 4 times', () => {
    const conditions = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
    const times = ['dawn', 'day', 'dusk', 'night'];
    const pattern = /^assets\/images\/bg\/[a-z-]+\/week_[1-4]\/(dawn|day|dusk|night)\/[1-7]\.webp\?v=20260718-p1$/;
    let combos = 0;
    for (const cond of conditions) {
      for (let w = 1; w <= 4; w++) {
        for (const t of times) {
          for (let r = 1; r <= 7; r++) {
            combos++;
            const c = buildPickerPaths(cond, 'clear', t, w, r);
            expect(c[0]).toMatch(pattern);
          }
        }
      }
    }
    expect(combos).toBe(1008); // 9 × 4 × 4 × 7
  });

  it('clamps invalid week values to 1', () => {
    expect(buildPickerPaths('clear', 'clear', 'day', 0, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', 'day', 5, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', 'day', -1, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', 'day', NaN, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260718-p1');
  });

  it('clamps invalid r values to 1', () => {
    expect(buildPickerPaths('clear', 'clear', 'day', 1, 0)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', 'day', 1, 8)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', 'day', 1, 99)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', 'day', 1, -1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
  });

  it('clamps invalid timeOfDay to day', () => {
    expect(buildPickerPaths('clear', 'clear', 'twilight', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', '', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths('clear', 'clear', null, 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
  });

  it('defaults empty folder to clear', () => {
    expect(buildPickerPaths('', 'clear', 'day', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths(null, null, 'day', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
    expect(buildPickerPaths(undefined, undefined, 'day', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260718-p1');
  });

  it('honours a custom base path (last entry is always the default guard)', () => {
    const c = buildPickerPaths('clear', 'clear', 'day', 2, 3, '/cdn/v2');
    expect(c[0]).toBe('/cdn/v2/clear/week_2/day/3.webp?v=20260718-p1');
    expect(c[c.length - 1]).toBe('/cdn/v2/default.jpg');
  });

  it('does not contain ".." or other path-escape characters', () => {
    const all = buildPickerPaths('cold-clear', 'clear', 'dusk', 3, 6);
    for (const p of all) {
      expect(p).not.toMatch(/\.\.|\/\/|\\/);
    }
  });

  it('warns once when folder is non-empty but not in the known list (typo defense)', () => {
    _resetWarnedFolders(); // ensure no prior test left state in the warn-once cache
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      buildPickerPaths('cleer', 'clear', 'day', 1, 1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/unknown folder "cleer"/);
      // Second call with the same unknown folder must NOT re-warn.
      buildPickerPaths('cleer', 'clear', 'day', 1, 1);
      buildPickerPaths('cleer', 'clear', 'dawn', 2, 3);
      expect(warn).toHaveBeenCalledTimes(1);
      // A different unknown folder warns separately.
      buildPickerPaths('storrm', 'clear', 'day', 1, 1);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn for any of the 9 known condition folders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const cond of ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind']) {
        buildPickerPaths(cond, 'clear', 'day', 1, 1);
      }
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn for empty/null/undefined folder (those just default to clear)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      buildPickerPaths('', 'clear', 'day', 1, 1);
      buildPickerPaths(null, 'clear', 'day', 1, 1);
      buildPickerPaths(undefined, 'clear', 'day', 1, 1);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('pickRandomIndex', () => {
  let spy;
  beforeEach(() => { spy = vi.spyOn(Math, 'random'); });
  afterEach(() => { spy.mockRestore(); });

  it('returns 1 when Math.random() = 0', () => {
    spy.mockReturnValue(0);
    expect(pickRandomIndex()).toBe(1);
  });

  it('returns 4 when Math.random() = 0.5', () => {
    // floor(0.5 * 7) + 1 = floor(3.5) + 1 = 3 + 1 = 4
    spy.mockReturnValue(0.5);
    expect(pickRandomIndex()).toBe(4);
  });

  it('returns 7 when Math.random() = 0.99', () => {
    // floor(0.99 * 7) + 1 = floor(6.93) + 1 = 6 + 1 = 7
    spy.mockReturnValue(0.99);
    expect(pickRandomIndex()).toBe(7);
  });

  it('returns 7 at the upper edge (just below 1)', () => {
    spy.mockReturnValue(0.9999999);
    expect(pickRandomIndex()).toBe(7);
  });

  it('always returns an integer in 1..7 across 1000 calls', () => {
    spy.mockRestore(); // use real Math.random
    for (let i = 0; i < 1000; i++) {
      const r = pickRandomIndex();
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(7);
    }
  });
});
