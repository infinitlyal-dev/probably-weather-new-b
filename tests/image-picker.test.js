// Unit tests for assets/image-picker.js.
// Pure-function module — no DOM, no jsdom needed.
//
// The day IS the slot index (SAST weekday, Monday = 1 … Sunday = 7) and weeks
// run Monday–Sunday in SAST. Anchor: WEEK_ANCHOR_MS = Monday 25 May 2026 00:00
// SAST = Sunday 24 May 22:00 UTC. Every instant below is pinned, never Date.now().

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  WEEK_ANCHOR_MS,
  WEEK_MS,
  DAY_MS,
  SAST_OFFSET_MS,
  BG_IMAGE_URL_VERSION,
  getRotationDay,
  getRotationWeek,
  buildPickerPaths,
  _resetWarnedFolders,
} from '../assets/image-picker.js';

// SAST wall-clock → UTC ms. SAST is UTC+2 with no daylight saving.
const sast = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min) - SAST_OFFSET_MS;

describe('WEEK_ANCHOR_MS sanity', () => {
  it('is Monday 25 May 2026 00:00 SAST (= Sunday 24 May 22:00 UTC)', () => {
    expect(WEEK_ANCHOR_MS).toBe(Date.UTC(2026, 4, 24, 22, 0, 0, 0));
    expect(new Date(WEEK_ANCHOR_MS + SAST_OFFSET_MS).getUTCDay()).toBe(1); // Monday in SAST
    expect(new Date(WEEK_ANCHOR_MS).getUTCDay()).toBe(0);                  // still Sunday in UTC
  });

  it('keeps launch day (Saturday 30 May 2026) inside week_1', () => {
    expect(getRotationWeek(sast(2026, 5, 30, 0, 0))).toBe(1);
    expect(getRotationWeek(sast(2026, 5, 30, 23, 59))).toBe(1);
  });
});

describe('getRotationDay — the SAST weekday is the slot index', () => {
  it('Sunday 6 Sept 2026 21:00 SAST → 7', () => {
    expect(getRotationDay(sast(2026, 9, 6, 21, 0))).toBe(7);
  });

  it('Monday 7 Sept 2026 00:30 SAST → 1', () => {
    expect(getRotationDay(sast(2026, 9, 7, 0, 30))).toBe(1);
  });

  it('an instant that is still Sunday in UTC but already Monday in SAST → Monday', () => {
    // Sunday 6 Sept 2026 22:30 UTC = Monday 7 Sept 00:30 SAST.
    const utcSunday = Date.UTC(2026, 8, 6, 22, 30);
    expect(new Date(utcSunday).getUTCDay()).toBe(0); // proves the premise: UTC says Sunday
    expect(getRotationDay(utcSunday)).toBe(1);
  });

  it('an instant that is Sunday in SAST but already Monday further east → still Sunday', () => {
    // Sunday 6 Sept 2026 23:30 SAST = 21:30 UTC = Monday 06:30 in Sydney. The device is irrelevant.
    expect(getRotationDay(sast(2026, 9, 6, 23, 30))).toBe(7);
  });

  it('walks Monday=1 … Sunday=7 across a full SAST week', () => {
    const monday = sast(2026, 9, 7, 12, 0); // Monday noon
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => getRotationDay(monday + d * DAY_MS))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('flips exactly at SAST midnight, not UTC midnight', () => {
    expect(getRotationDay(sast(2026, 9, 6, 23, 59))).toBe(7);
    expect(getRotationDay(sast(2026, 9, 7, 0, 0))).toBe(1);
    expect(getRotationDay(sast(2026, 9, 7, 1, 59))).toBe(1); // still before UTC midnight
  });

  it('returns 1 for NaN / non-finite input', () => {
    expect(getRotationDay(NaN)).toBe(1);
    expect(getRotationDay(Infinity)).toBe(1);
    expect(getRotationDay(-Infinity)).toBe(1);
  });

  it('defaults to Date.now() and stays in 1..7', () => {
    expect([1, 2, 3, 4, 5, 6, 7]).toContain(getRotationDay());
    expect([1, 2, 3, 4, 5, 6, 7]).toContain(getRotationDay(undefined));
  });
});

describe('getRotationWeek — Monday 00:00 SAST boundaries, 4-week folder cycle', () => {
  it('Sunday 6 Sept 2026 21:00 SAST is week 3; Monday 00:30 SAST is the next week (4)', () => {
    expect(getRotationWeek(sast(2026, 9, 6, 21, 0))).toBe(3);
    expect(getRotationWeek(sast(2026, 9, 7, 0, 30))).toBe(4);
  });

  it('the week does not change between Saturday and Sunday (the old Saturday anchor is gone)', () => {
    expect(getRotationWeek(sast(2026, 9, 5, 23, 59))).toBe(getRotationWeek(sast(2026, 9, 6, 0, 1)));
  });

  it('flips at Monday 00:00 SAST exactly, which is Sunday 22:00 UTC', () => {
    const boundary = WEEK_ANCHOR_MS + 14 * DAY_MS; // week_2 → week_3
    expect(getRotationWeek(boundary - 60 * 1000)).toBe(2);
    expect(getRotationWeek(boundary)).toBe(3);
    expect(getRotationWeek(boundary + 60 * 1000)).toBe(3);
    expect(new Date(boundary).getUTCHours()).toBe(22);
    expect(new Date(boundary).getUTCDay()).toBe(0);
  });

  it('cycles 1 → 2 → 3 → 4 → 1 week by week from the anchor', () => {
    expect([0, 1, 2, 3, 4, 5].map((w) => getRotationWeek(WEEK_ANCHOR_MS + w * WEEK_MS))).toEqual([1, 2, 3, 4, 1, 2]);
    expect(getRotationWeek(WEEK_ANCHOR_MS + 6 * DAY_MS + 23 * 60 * 60 * 1000)).toBe(1); // Sunday 23:00 of week 1
  });

  it('week A (folders 1 and 3) alternates with week B (folders 2 and 4) — a two-week cycle', () => {
    const letters = [0, 1, 2, 3, 4, 5, 6, 7].map((w) => (getRotationWeek(WEEK_ANCHOR_MS + w * WEEK_MS) % 2 === 1 ? 'A' : 'B'));
    expect(letters).toEqual(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
  });

  it('stays in 1..4 across years', () => {
    expect(getRotationWeek(WEEK_ANCHOR_MS + 52 * WEEK_MS)).toBe(1); // 52 weeks = 13 cycles
    expect(getRotationWeek(WEEK_ANCHOR_MS + 53 * WEEK_MS)).toBe(2);
    expect([1, 2, 3, 4]).toContain(getRotationWeek(Date.UTC(2030, 0, 1)));
    expect([1, 2, 3, 4]).toContain(getRotationWeek(Date.UTC(2040, 6, 15)));
  });

  it('returns 1 for any instant before the anchor', () => {
    expect(getRotationWeek(WEEK_ANCHOR_MS - 1)).toBe(1);
    expect(getRotationWeek(WEEK_ANCHOR_MS - 100 * WEEK_MS)).toBe(1);
    expect(getRotationWeek(0)).toBe(1);
  });

  it('returns 1 for NaN / non-finite input', () => {
    expect(getRotationWeek(NaN)).toBe(1);
    expect(getRotationWeek(Infinity)).toBe(1);
    expect(getRotationWeek(-Infinity)).toBe(1);
  });

  it('defaults to Date.now() when called with no argument', () => {
    expect([1, 2, 3, 4]).toContain(getRotationWeek());
  });
});

describe('buildPickerPaths', () => {
  it('P1 versions every rotating WebP URL while leaving the JPG guard stable', () => {
    const paths = buildPickerPaths('cold', 'cloudy', 'night', 2, 5);
    expect(paths.slice(0, -1).every((url) => url.endsWith(`?v=${BG_IMAGE_URL_VERSION}`))).toBe(true);
    expect(paths.at(-1)).toBe('assets/images/bg/default.jpg');
  });

  it('builds a deduped chain — clear/day/week_1/r=3 drops a redundant step', () => {
    // For clear/clear, step 2 (week_1 collapse) and step 3 (sibling collapse)
    // produce the same path, so the deduper merges them.
    const c = buildPickerPaths('clear', 'clear', 'day', 1, 3);
    expect(c).toEqual([
      'assets/images/bg/clear/week_1/day/3.webp?v=20260906-grid',
      'assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('uses cloudy as sibling fallback for cold (full 4-step chain — no collapse)', () => {
    const c = buildPickerPaths('cold', 'cloudy', 'night', 2, 5);
    expect(c).toEqual([
      'assets/images/bg/cold/week_2/night/5.webp?v=20260906-grid',
      'assets/images/bg/cold/week_1/night/1.webp?v=20260906-grid',
      'assets/images/bg/cloudy/week_1/night/1.webp?v=20260906-grid',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('dedupes when r=1 collapses primary into week_1 fallback', () => {
    const c = buildPickerPaths('cold', 'cloudy', 'day', 1, 1);
    // primary = cold/week_1/day/1.webp == step 2 → dedupes
    expect(c).toEqual([
      'assets/images/bg/cold/week_1/day/1.webp?v=20260906-grid',
      'assets/images/bg/cloudy/week_1/day/1.webp?v=20260906-grid',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('dedupes worst-case r=1 with folder == fallbackFolder → just 2 entries', () => {
    const c = buildPickerPaths('clear', 'clear', 'day', 1, 1);
    expect(c).toEqual([
      'assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid',
      'assets/images/bg/default.jpg',
    ]);
  });

  it('handles cold-clear without URL encoding the hyphen', () => {
    const c = buildPickerPaths('cold-clear', 'clear', 'dawn', 4, 7);
    expect(c[0]).toBe('assets/images/bg/cold-clear/week_4/dawn/7.webp?v=20260906-grid');
    expect(c[0]).not.toMatch(/%/);
  });

  it('produces valid paths for all 9 conditions × 4 weeks × 4 times', () => {
    const conditions = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
    const times = ['dawn', 'day', 'dusk', 'night'];
    const pattern = /^assets\/images\/bg\/[a-z-]+\/week_[1-4]\/(dawn|day|dusk|night)\/[1-7]\.webp\?v=20260906-grid$/;
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
    expect(buildPickerPaths('clear', 'clear', 'day', 0, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', 'day', 5, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', 'day', -1, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', 'day', NaN, 3)[0]).toBe('assets/images/bg/clear/week_1/day/3.webp?v=20260906-grid');
  });

  it('clamps invalid r values to 1', () => {
    expect(buildPickerPaths('clear', 'clear', 'day', 1, 0)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', 'day', 1, 8)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', 'day', 1, 99)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', 'day', 1, -1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
  });

  it('clamps invalid timeOfDay to day', () => {
    expect(buildPickerPaths('clear', 'clear', 'twilight', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', '', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths('clear', 'clear', null, 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
  });

  it('defaults empty folder to clear', () => {
    expect(buildPickerPaths('', 'clear', 'day', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths(null, null, 'day', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
    expect(buildPickerPaths(undefined, undefined, 'day', 1, 1)[0]).toBe('assets/images/bg/clear/week_1/day/1.webp?v=20260906-grid');
  });

  it('honours a custom base path (last entry is always the default guard)', () => {
    const c = buildPickerPaths('clear', 'clear', 'day', 2, 3, '/cdn/v2');
    expect(c[0]).toBe('/cdn/v2/clear/week_2/day/3.webp?v=20260906-grid');
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

// The picker, the bespoke hero line and the condition bank's weekend / day-tag
// routing must all read the day from ONE function. Source-level wiring proof:
// app.js has no other day-of-week derivation left on the paint path.
describe('app.js wiring — one day function for photograph, line and weekend rule', () => {
  const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it('imports getRotationDay and no longer imports pickRandomIndex', () => {
    expect(appSrc).toMatch(/import\s*\{[^}]*getRotationDay[^}]*\}\s*from\s*['"]\.\/image-picker\.js['"]/);
    expect(appSrc).not.toMatch(/pickRandomIndex/);
  });

  it('setBackgroundFor takes the slot index from getRotationDay(), with no memo and no Math.random', () => {
    const fn = appSrc.match(/function setBackgroundFor\(condition\) \{[\s\S]*?\n  \}/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/const r = getRotationDay\(\);/);
    expect(fn).not.toMatch(/Math\.random|__pickerMemo/);
    expect(appSrc).not.toMatch(/__pickerMemo|PICKER_MEMO_CAP/);
  });

  it('getLocationDayOfWeek derives its 0..6 day from getRotationDay() (Sunday 7 → 0)', () => {
    const fn = appSrc.match(/function getLocationDayOfWeek\(\) \{[\s\S]*?\n  \}/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/return getRotationDay\(\) % 7;/);
    expect(fn).not.toMatch(/utcOffsetSeconds|getDay\(\)|getUTCDay/);
    // Sunday: picker index 7, bank day 0 — the same instant, both functions.
    expect(getRotationDay(sast(2026, 9, 6, 21, 0)) % 7).toBe(0);
    expect(getRotationDay(sast(2026, 9, 5, 21, 0)) % 7).toBe(6);
  });
});
