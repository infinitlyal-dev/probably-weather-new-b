import { describe, expect, it } from 'vitest';
import {
  isHourDaylight,
  parseLocalIsoMinutes,
  pickHourlyIcon,
} from '../assets/weather-emoji.js';

// ---------------------------------------------------------------------------
// Bug 2b — real solar day/night for hourly emojis (2026-05-24).
//
// The hourly rows hardcoded "night" as hour >= 20 || hour < 5. On 2026-05-21
// Cape Town's sunset was ~17:45, so the 18:00 and 19:00 slots showed a bright
// `sun` nearly two hours after dark. isHourDaylight() replaces the clock band
// with the day's actual sunrise/sunset.
// ---------------------------------------------------------------------------

// Sunrise/sunset in minutes-since-local-midnight for the test locations.
const CT     = { sunrise: 6 * 60 + 45, sunset: 17 * 60 + 45 }; // Cape Town, 21 May
const JHB    = { sunrise: 6 * 60 + 30, sunset: 17 * 60 + 30 }; // Joburg, 21 May
const KAROO  = { sunrise: 5 * 60 + 30, sunset: 19 * 60 + 30 }; // Karoo, December

describe('parseLocalIsoMinutes', () => {
  it('parses a local-labelled ISO timestamp to minutes since midnight', () => {
    expect(parseLocalIsoMinutes('2026-05-21T17:45')).toBe(17 * 60 + 45);
    expect(parseLocalIsoMinutes('2026-05-21T06:45')).toBe(6 * 60 + 45);
    expect(parseLocalIsoMinutes('2026-12-01T00:00')).toBe(0);
  });

  it('returns null for missing or malformed input', () => {
    expect(parseLocalIsoMinutes(null)).toBe(null);
    expect(parseLocalIsoMinutes(undefined)).toBe(null);
    expect(parseLocalIsoMinutes('')).toBe(null);
    expect(parseLocalIsoMinutes('2026-05-21')).toBe(null); // too short, no time
  });
});

describe('isHourDaylight — Cape Town, 21 May (the reported bug)', () => {
  it('18:00 slot is NIGHT — sunset was 17:45 (this was the `sun`-after-dark bug)', () => {
    expect(isHourDaylight(18, CT.sunrise, CT.sunset)).toBe(false);
  });
  it('19:00 slot is NIGHT', () => {
    expect(isHourDaylight(19, CT.sunrise, CT.sunset)).toBe(false);
  });
  it('12:00 (midday) is DAY', () => {
    expect(isHourDaylight(12, CT.sunrise, CT.sunset)).toBe(true);
  });
  it('07:00 is DAY, 06:00 is still NIGHT (sunrise 06:45)', () => {
    expect(isHourDaylight(7, CT.sunrise, CT.sunset)).toBe(true);
    expect(isHourDaylight(6, CT.sunrise, CT.sunset)).toBe(false);
  });
});

describe('isHourDaylight — Joburg & Karoo', () => {
  it('Joburg: 18:00 is NIGHT (sunset 17:30)', () => {
    expect(isHourDaylight(18, JHB.sunrise, JHB.sunset)).toBe(false);
  });
  it('Joburg: 16:00 is DAY', () => {
    expect(isHourDaylight(16, JHB.sunrise, JHB.sunset)).toBe(true);
  });
  it('Karoo December: 18:00 is DAY (late summer sunset 19:30)', () => {
    expect(isHourDaylight(18, KAROO.sunrise, KAROO.sunset)).toBe(true);
  });
  it('Karoo December: 05:00 is DAY (early summer sunrise 05:30)', () => {
    expect(isHourDaylight(5, KAROO.sunrise, KAROO.sunset)).toBe(true);
  });
  it('Karoo December: 20:00 is NIGHT', () => {
    expect(isHourDaylight(20, KAROO.sunrise, KAROO.sunset)).toBe(false);
  });
});

describe('isHourDaylight — midnight boundary', () => {
  // The comparison is hour-of-day vs time-of-day, so it resolves correctly
  // whether the slot belongs to today or tomorrow.
  it('23:00, 00:00 and 02:00 slots are all NIGHT', () => {
    for (const h of [23, 0, 1, 2, 3]) {
      expect(isHourDaylight(h, CT.sunrise, CT.sunset)).toBe(false);
    }
  });
});

describe('isHourDaylight — missing data falls back to null', () => {
  it('returns null when sunrise/sunset is missing (caller uses its own default)', () => {
    expect(isHourDaylight(18, null, null)).toBe(null);
    expect(isHourDaylight(18, CT.sunrise, undefined)).toBe(null);
    expect(isHourDaylight(18, NaN, CT.sunset)).toBe(null);
  });
  it('returns null for a non-integer hour', () => {
    expect(isHourDaylight(18.5, CT.sunrise, CT.sunset)).toBe(null);
    expect(isHourDaylight('18', CT.sunrise, CT.sunset)).toBe(null);
  });
});

describe('integration — the 18:00 hourly emoji after a 17:45 sunset', () => {
  it('a clear 18:00 hour renders the moon `moon`, not the sun `sun`', () => {
    // This is what renderHourly now does: isNightHour = !isHourDaylight(...).
    const isNightHour = !isHourDaylight(18, CT.sunrise, CT.sunset);
    expect(isNightHour).toBe(true);
    const icon = pickHourlyIcon({ rainPct: 0, cloudPct: 5, tempC: 14, isNight: isNightHour });
    expect(icon).toBe('moon');
  });

  it('a clear 13:00 hour still renders the sun `sun`', () => {
    const isNightHour = !isHourDaylight(13, CT.sunrise, CT.sunset);
    expect(isNightHour).toBe(false);
    const icon = pickHourlyIcon({ rainPct: 0, cloudPct: 5, tempC: 22, isNight: isNightHour });
    expect(icon).toBe('sun');
  });

  it('fallback path: with no solar data, renderHourly keeps the old 20:00 band', () => {
    // isHourDaylight returns null → renderHourly uses (hour >= 20 || hour < 5).
    const daylight = isHourDaylight(18, null, null);
    const isNightHour = daylight === null ? (18 >= 20 || 18 < 5) : !daylight;
    expect(isNightHour).toBe(false); // old behaviour preserved when data absent
  });
});
