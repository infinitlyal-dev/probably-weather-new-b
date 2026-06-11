// M2 — coordinate-based UTC offset fallback (api/weather.js).
//
// When Open-Meteo, Pirate Weather AND WeatherAPI all fail to supply an offset,
// the old code silently defaulted to 0 (UTC). For SA (UTC+2) that shifted
// every local-time decision by two hours — including the client's day-of-week,
// which is what let the "Saturday energy" weekend line fire on a Sunday
// morning (SAST Sun 00:00–01:59 computed as Saturday under offset 0).

import { describe, expect, it } from 'vitest';

import { estimateUtcOffsetSeconds } from '../api/weather.js';
import { filterWeekendPoolForDay, WEATHER_COPY } from '../assets/weather-copy.js';

// Mirror of app.js getLocationDayOfWeek's core: shift the UTC instant by the
// offset, read the day with getUTCDay.
const dayOfWeekAt = (utcMs, offsetSeconds) => new Date(utcMs + offsetSeconds * 1000).getUTCDay();

describe('estimateUtcOffsetSeconds — coordinate fallback', () => {
  it('returns SAST (+7200) everywhere inside the SA bounding box', () => {
    expect(estimateUtcOffsetSeconds(-34.1163, 18.8362)).toBe(7200); // Strand
    expect(estimateUtcOffsetSeconds(-26.2041, 28.0473)).toBe(7200); // Joburg
    expect(estimateUtcOffsetSeconds(-29.8587, 31.0218)).toBe(7200); // Durban
    expect(estimateUtcOffsetSeconds(-23.9, 29.45)).toBe(7200);      // Polokwane
  });

  it('falls back to the longitude band outside SA', () => {
    expect(estimateUtcOffsetSeconds(51.5, -0.1)).toBe(0);        // London
    expect(estimateUtcOffsetSeconds(40.7, -74.0)).toBe(-5 * 3600); // New York
    expect(estimateUtcOffsetSeconds(35.7, 139.7)).toBe(9 * 3600);  // Tokyo
  });

  it('never returns a non-finite or absurd offset for junk input', () => {
    expect(estimateUtcOffsetSeconds(NaN, NaN)).toBe(0);
    expect(estimateUtcOffsetSeconds(undefined, undefined)).toBe(0);
    expect(Math.abs(estimateUtcOffsetSeconds(0, 180))).toBeLessThanOrEqual(12 * 3600);
  });
});

describe('SA Sunday-morning boundary — real Dates through the weekend filter', () => {
  // Saturday 2026-06-13 22:30 UTC === Sunday 2026-06-14 00:30 SAST.
  const utcSaturdayNight = Date.UTC(2026, 5, 13, 22, 30, 0);

  it('offset 0 (the OLD default) mislabels SAST Sunday morning as Saturday', () => {
    expect(dayOfWeekAt(utcSaturdayNight, 0)).toBe(6); // Saturday — the bug
  });

  it('the SA coordinate fallback puts the user on Sunday, where they actually are', () => {
    const offset = estimateUtcOffsetSeconds(-34.1163, 18.8362);
    expect(dayOfWeekAt(utcSaturdayNight, offset)).toBe(0); // Sunday
  });

  it('with the corrected day, the weekend pool drops the Saturday-named line in every language', () => {
    const offset = estimateUtcOffsetSeconds(-34.1163, 18.8362);
    const day = dayOfWeekAt(utcSaturdayNight, offset);
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      const pool = WEATHER_COPY.witty.weekend[lang];
      const filtered = filterWeekendPoolForDay(pool, day);
      const saturdayNamed = filtered.filter((l) =>
        /saturday energy|saterdagenergie|mgqibelo|moqebelo/i.test(l));
      expect(saturdayNamed, `${lang} Sunday pool must carry no Saturday-named lines`).toEqual([]);
      expect(filtered.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('control: on an actual SAST Saturday the full pool (incl. the Saturday line) is allowed', () => {
    // Saturday 2026-06-13 10:00 SAST = 08:00 UTC.
    const utcSaturdayMorning = Date.UTC(2026, 5, 13, 8, 0, 0);
    const day = dayOfWeekAt(utcSaturdayMorning, 7200);
    expect(day).toBe(6);
    const pool = WEATHER_COPY.witty.weekend.en;
    expect(filterWeekendPoolForDay(pool, day)).toEqual(pool);
  });
});
