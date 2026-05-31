// Weekend witty pool — day-of-week correctness.
//
// Bug (audit 2026-05-31, visible to online weekend users): getWittyLine()
// returns a RANDOM line from the single undifferentiated T.witty.weekend pool
// for clear/heat on any weekend day (Sat=6, Sun=0, Fri>=16:00), bypassing the
// WEEKDAY_ONLY_FRAGMENTS filter via an early return. That pool's index 19 is a
// Saturday-NAMED line in all five languages (EN "Saturday energy…", AF
// "Saterdagenergie…", ZU/XH "Amandla angoMgqibelo…", ST "Matla a Moqebelo…"),
// so a Sunday (or Friday-evening) draw can surface a Saturday line.
//
// Fix: filterWeekendPoolForDay(pool, day) drops day-named weekend lines that
// don't match the computed day, re-using the existing native-reviewed copy
// (no text is invented or re-translated — lines are only re-bucketed by day).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  WEATHER_COPY,
  WEEKEND_SATURDAY_FRAGMENTS,
  filterWeekendPoolForDay,
} from '../assets/weather-copy.js';

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const matchesSaturday = (line) => {
  const l = String(line).toLowerCase();
  return WEEKEND_SATURDAY_FRAGMENTS.some((f) => l.includes(f));
};

describe('WEEKEND_SATURDAY_FRAGMENTS — covers all 5 languages', () => {
  it('each weekend pool has exactly one Saturday-named line', () => {
    for (const lang of LANGS) {
      const pool = WEATHER_COPY.witty.weekend[lang];
      const named = pool.filter(matchesSaturday);
      expect(named, `expected exactly 1 Saturday-named line in ${lang}`).toHaveLength(1);
    }
  });
});

describe('filterWeekendPoolForDay — day correctness across all 5 languages', () => {
  for (const lang of LANGS) {
    const pool = WEATHER_COPY.witty.weekend[lang];

    it(`${lang}: Saturday (day 6) keeps the full pool incl. the Saturday line`, () => {
      const out = filterWeekendPoolForDay(pool, 6);
      expect(out).toHaveLength(pool.length);
      expect(out.some(matchesSaturday)).toBe(true);
    });

    it(`${lang}: Sunday (day 0) drops the Saturday-named line`, () => {
      const out = filterWeekendPoolForDay(pool, 0);
      expect(out.some(matchesSaturday)).toBe(false);
      expect(out).toHaveLength(pool.length - 1);
    });

    it(`${lang}: Friday-evening (day 5) also drops the Saturday-named line`, () => {
      const out = filterWeekendPoolForDay(pool, 5);
      expect(out.some(matchesSaturday)).toBe(false);
    });

    it(`${lang}: agnostic weekend lines survive on Sunday (only the day-named one is removed)`, () => {
      const out = filterWeekendPoolForDay(pool, 0);
      const removed = pool.filter((l) => !out.includes(l));
      expect(removed.every(matchesSaturday)).toBe(true); // nothing agnostic was dropped
      expect(out.length).toBeGreaterThanOrEqual(3);       // never collapse the pool
    });

    it(`${lang}: does not mutate the input pool`, () => {
      const before = pool.length;
      filterWeekendPoolForDay(pool, 0);
      expect(pool).toHaveLength(before);
    });
  }
});

// ---------------------------------------------------------------------------
// app.js wiring — the weekend branch must apply the day filter, not raw-random.
// ---------------------------------------------------------------------------
describe('app.js wiring — weekend pool is day-filtered', () => {
  const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it('imports filterWeekendPoolForDay from weather-copy.js', () => {
    expect(appSrc).toMatch(/filterWeekendPoolForDay/);
  });

  it('applies the day filter inside the weekend branch (not a raw random pick)', () => {
    // The weekend branch must pass the computed `day` through the filter.
    expect(appSrc).toMatch(/filterWeekendPoolForDay\(\s*[^,]+,\s*day\s*\)/);
  });
});
