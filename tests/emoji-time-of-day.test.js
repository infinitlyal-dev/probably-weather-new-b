import { describe, expect, it } from 'vitest';
import {
  pickConditionIconForTime,
  pickHourlyIcon,
  __WEATHER_ICON_MAP,
} from '../assets/weather-emoji.js';
import { ICON_NAMES } from '../assets/weather-icons.js';

// ---------------------------------------------------------------------------
// M5: the picker returns ICON NAMES now, not platform emoji. Every assertion
// below is the same assertion it was, restated against the drawn family —
// plus one the emoji era could not make: the name must actually resolve to a
// drawing, so a typo'd key can never ship as a silently empty icon slot.
//
// Icons we never want to render at night, regardless of how the condition
// keyed into the picker. These all contain a visible sun.
// ---------------------------------------------------------------------------
const DAYTIME_ONLY_ICONS = new Set(['sun', 'cloud-sun', 'rain-sun']);

// Hours that count as "night" in the legacy app.js rule (hour >= 20 || < 5).
const NIGHT_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4];
const DAY_HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const CONDITIONS = [
  'clear',
  'cloudy',
  'partly-cloudy',
  'rain',
  'rain-possible',
  'storm',
  'thunder',
  'hail',
  'fog',
  'wind',
  'cold',
  'heat',
  'uv',
];

// ---------------------------------------------------------------------------
// 1) condition × hour 0-23 × isDay∈{true,false} — never emit a sun at night.
// ---------------------------------------------------------------------------
describe('pickConditionIconForTime — no sun icons at night', () => {
  for (const condition of CONDITIONS) {
    for (let hour = 0; hour < 24; hour += 1) {
      const isNight = hour >= 20 || hour < 5;
      const isDay = !isNight;
      it(`${condition} @ ${String(hour).padStart(2, '0')}:00 (isDay=${isDay}) renders a sane icon`, () => {
        const icon = pickConditionIconForTime(condition, isDay);
        expect(typeof icon).toBe('string');
        expect(icon.length).toBeGreaterThan(0);
        expect(ICON_NAMES, `${icon} has no drawing`).toContain(icon);
        if (isNight) {
          expect(DAYTIME_ONLY_ICONS.has(icon)).toBe(false);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 2) The exact 20:00 sun-with-rain-cloud bug — rain-possible used to return the
//    sun-behind-rain-cloud icon regardless of time. At 20:00 it must not.
// ---------------------------------------------------------------------------
describe('20:00 sun-at-night regression', () => {
  it('rain-possible at 20:00 does not render the sun-behind-rain-cloud icon', () => {
    const icon = pickConditionIconForTime('rain-possible', false);
    expect(icon).not.toBe('rain-sun');
    expect(icon).toBe('rain');
  });

  it('rain-possible during the day still renders the sun-behind-rain-cloud icon', () => {
    expect(pickConditionIconForTime('rain-possible', true)).toBe('rain-sun');
  });

  it('partly-cloudy at 20:00 does not render the sun-behind-cloud icon', () => {
    expect(pickConditionIconForTime('partly-cloudy', false)).not.toBe('cloud-sun');
    expect(pickConditionIconForTime('partly-cloudy', false)).toBe('cloud');
  });

  it('clear at 20:00 renders moon, not sun', () => {
    expect(pickConditionIconForTime('clear', false)).toBe('moon');
    expect(pickConditionIconForTime('clear', true)).toBe('sun');
  });

  it('uv at 20:00 renders moon, not sun (UV at night = no sun visual)', () => {
    expect(pickConditionIconForTime('uv', false)).toBe('moon');
  });
});

// ---------------------------------------------------------------------------
// 3) Cloud day/night differentiation — partly-cloudy vs cloudy.
// ---------------------------------------------------------------------------
describe('cloud day/night differentiation', () => {
  it('partly-cloudy day vs night differ (sun-behind-cloud → plain cloud)', () => {
    const day = pickConditionIconForTime('partly-cloudy', true);
    const night = pickConditionIconForTime('partly-cloudy', false);
    expect(day).not.toBe(night);
    expect(day).toBe('cloud-sun');
    expect(night).toBe('cloud');
  });

  it('cloudy night and partly-cloudy night both fall back to the plain cloud', () => {
    expect(pickConditionIconForTime('cloudy', false)).toBe('cloud');
    expect(pickConditionIconForTime('partly-cloudy', false)).toBe('cloud');
  });

  it('cloudy day stays the plain cloud (it reads in any light)', () => {
    expect(pickConditionIconForTime('cloudy', true)).toBe('cloud');
  });
});

// ---------------------------------------------------------------------------
// 4) pickHourlyIcon — walks rain + cloud + temp branches across hour 0-23.
//    These mirror getWeatherIcon's branch order so we lock the legacy logic
//    while guaranteeing night-time correctness.
// ---------------------------------------------------------------------------
describe('pickHourlyIcon — branch parity with legacy getWeatherIcon', () => {
  it('tc <= 0 wins everything (cold beats rain/cloud)', () => {
    expect(pickHourlyIcon({ rainPct: 90, cloudPct: 100, tempC: -1, isNight: false })).toBe('cold');
    expect(pickHourlyIcon({ rainPct: 90, cloudPct: 100, tempC: -1, isNight: true })).toBe('cold');
  });

  it('rainPct >= 50 returns the rain icon regardless of day/night', () => {
    for (const hour of DAY_HOURS.concat(NIGHT_HOURS)) {
      const isNight = hour >= 20 || hour < 5;
      expect(pickHourlyIcon({ rainPct: 60, cloudPct: 30, tempC: 18, isNight })).toBe('rain');
    }
  });

  it('rainPct >= 30 (rain-possible) differs day vs night', () => {
    for (const hour of DAY_HOURS) {
      expect(pickHourlyIcon({ rainPct: 35, cloudPct: 30, tempC: 18, isNight: false })).toBe('rain-sun');
    }
    for (const hour of NIGHT_HOURS) {
      expect(pickHourlyIcon({ rainPct: 35, cloudPct: 30, tempC: 18, isNight: true })).toBe('rain');
    }
  });

  it('tc >= 35 returns the heat icon day and night', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 36, isNight: false })).toBe('heat');
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 36, isNight: true })).toBe('heat');
  });

  it('cloudPct >= 55 returns the plain cloud day and night', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 80, tempC: 18, isNight: false })).toBe('cloud');
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 80, tempC: 18, isNight: true })).toBe('cloud');
  });

  it('cloudPct >= 30 (partly cloudy) differs day vs night', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 50, tempC: 18, isNight: false })).toBe('cloud-sun');
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 50, tempC: 18, isNight: true })).toBe('cloud');
  });

  it('tc <= 10 returns the cold icon when no rain/cloud signal', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 8, isNight: false })).toBe('cold');
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 8, isNight: true })).toBe('cold');
  });

  it('clear fallback returns the sun by day and the moon by night', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 22, isNight: false })).toBe('sun');
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 22, isNight: true })).toBe('moon');
  });

  it('every hourly branch resolves to an icon that has a drawing', () => {
    const cases = [
      { rainPct: 90, cloudPct: 100, tempC: -1 },
      { rainPct: 60, cloudPct: 30, tempC: 18 },
      { rainPct: 35, cloudPct: 30, tempC: 18 },
      { rainPct: 0, cloudPct: 10, tempC: 36 },
      { rainPct: 0, cloudPct: 80, tempC: 18 },
      { rainPct: 0, cloudPct: 50, tempC: 18 },
      { rainPct: 0, cloudPct: 10, tempC: 8 },
      { rainPct: 0, cloudPct: 10, tempC: 22 },
      { rainPct: 0, cloudPct: 0, tempC: 18, condition: 'storm' },
      { rainPct: 0, cloudPct: 0, tempC: 18, condition: 'fog' },
    ];
    for (const base of cases) {
      for (const isNight of [false, true]) {
        expect(ICON_NAMES).toContain(pickHourlyIcon({ ...base, isNight }));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5) Full hour-by-hour sweep — verify that for every hour 0-23, no condition
//    that's supposed to be cloud-only or rain-only ever emits a daytime-only
//    icon during night hours.
// ---------------------------------------------------------------------------
describe('hour-by-hour sweep: no daytime-only icons at night', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const isNight = hour >= 20 || hour < 5;
    const isDay = !isNight;
    for (const condition of CONDITIONS) {
      it(`hour ${String(hour).padStart(2, '0')} ${condition} isDay=${isDay} → no sun icon at night`, () => {
        const icon = pickConditionIconForTime(condition, isDay);
        if (isNight) {
          expect(DAYTIME_ONLY_ICONS.has(icon)).toBe(false);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 6) Map contract — every entry has both day and night icons, both of which
//    resolve to a drawing, and unknown keys still produce a sane fallback.
// ---------------------------------------------------------------------------
describe('icon map contract', () => {
  it('every condition entry has both day and night icons, and both are drawn', () => {
    for (const [key, pair] of Object.entries(__WEATHER_ICON_MAP)) {
      expect(pair.day, `${key}.day`).toBeTruthy();
      expect(pair.night, `${key}.night`).toBeTruthy();
      expect(ICON_NAMES, `${key}.day (${pair.day}) has no drawing`).toContain(pair.day);
      expect(ICON_NAMES, `${key}.night (${pair.night}) has no drawing`).toContain(pair.night);
    }
  });

  it('unknown condition keys fall back without crashing', () => {
    expect(pickConditionIconForTime('martian-dust-devil', true)).toBeTruthy();
    expect(pickConditionIconForTime('martian-dust-devil', false)).toBeTruthy();
    expect(pickConditionIconForTime(null, true)).toBeTruthy();
    expect(pickConditionIconForTime(undefined, false)).toBeTruthy();
  });

  it('unknown condition fallback at night is not a sun icon', () => {
    expect(DAYTIME_ONLY_ICONS.has(pickConditionIconForTime('whatever', false))).toBe(false);
  });
});
