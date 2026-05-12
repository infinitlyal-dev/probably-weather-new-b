import { describe, expect, it } from 'vitest';
import {
  pickConditionEmojiForTime,
  pickHourlyEmoji,
  __WEATHER_EMOJI_MAP,
} from '../assets/weather-emoji.js';

// ---------------------------------------------------------------------------
// Glyphs we never want to render at night, regardless of how the condition
// keyed into the picker. These all contain a visible sun.
// ---------------------------------------------------------------------------
const DAYTIME_ONLY_GLYPHS = new Set(['☀️', '⛅', '🌦️']);

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
describe('pickConditionEmojiForTime — no sun glyphs at night', () => {
  for (const condition of CONDITIONS) {
    for (let hour = 0; hour < 24; hour += 1) {
      const isNight = hour >= 20 || hour < 5;
      const isDay = !isNight;
      it(`${condition} @ ${String(hour).padStart(2, '0')}:00 (isDay=${isDay}) renders a sane glyph`, () => {
        const glyph = pickConditionEmojiForTime(condition, isDay);
        expect(typeof glyph).toBe('string');
        expect(glyph.length).toBeGreaterThan(0);
        if (isNight) {
          expect(DAYTIME_ONLY_GLYPHS.has(glyph)).toBe(false);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 2) The exact 20:00 sun-with-rain-cloud bug — rain-possible used to return
//    🌦️ (sun behind rain cloud) regardless of time. At 20:00 it must not.
// ---------------------------------------------------------------------------
describe('20:00 sun-at-night regression', () => {
  it('rain-possible at 20:00 does not render the sun-behind-rain-cloud glyph', () => {
    const glyph = pickConditionEmojiForTime('rain-possible', false);
    expect(glyph).not.toBe('🌦️');
    expect(glyph).toBe('🌧️');
  });

  it('rain-possible during the day still renders the sun-behind-rain-cloud glyph', () => {
    expect(pickConditionEmojiForTime('rain-possible', true)).toBe('🌦️');
  });

  it('partly-cloudy at 20:00 does not render the sun-behind-cloud glyph', () => {
    expect(pickConditionEmojiForTime('partly-cloudy', false)).not.toBe('⛅');
    expect(pickConditionEmojiForTime('partly-cloudy', false)).toBe('☁️');
  });

  it('clear at 20:00 renders moon, not sun', () => {
    expect(pickConditionEmojiForTime('clear', false)).toBe('🌙');
    expect(pickConditionEmojiForTime('clear', true)).toBe('☀️');
  });

  it('uv at 20:00 renders moon, not sun (UV at night = no sun visual)', () => {
    expect(pickConditionEmojiForTime('uv', false)).toBe('🌙');
  });
});

// ---------------------------------------------------------------------------
// 3) Cloud day/night differentiation — partly-cloudy vs cloudy.
// ---------------------------------------------------------------------------
describe('cloud day/night differentiation', () => {
  it('partly-cloudy day vs night differ (sun-behind-cloud → plain cloud)', () => {
    const day = pickConditionEmojiForTime('partly-cloudy', true);
    const night = pickConditionEmojiForTime('partly-cloudy', false);
    expect(day).not.toBe(night);
    expect(day).toBe('⛅');
    expect(night).toBe('☁️');
  });

  it('cloudy night and partly-cloudy night both fall back to ☁️ (cloud read preserved)', () => {
    expect(pickConditionEmojiForTime('cloudy', false)).toBe('☁️');
    expect(pickConditionEmojiForTime('partly-cloudy', false)).toBe('☁️');
  });

  it('cloudy day stays as ☁️ (the canonical cloudy glyph reads in any light)', () => {
    expect(pickConditionEmojiForTime('cloudy', true)).toBe('☁️');
  });
});

// ---------------------------------------------------------------------------
// 4) pickHourlyEmoji — walks rain + cloud + temp branches across hour 0-23.
//    These mirror getWeatherIcon's branch order so we lock the legacy logic
//    while guaranteeing night-time correctness.
// ---------------------------------------------------------------------------
describe('pickHourlyEmoji — branch parity with legacy getWeatherIcon', () => {
  it('tc <= 0 wins everything (cold beats rain/cloud)', () => {
    expect(pickHourlyEmoji({ rainPct: 90, cloudPct: 100, tempC: -1, isNight: false })).toBe('❄️');
    expect(pickHourlyEmoji({ rainPct: 90, cloudPct: 100, tempC: -1, isNight: true })).toBe('❄️');
  });

  it('rainPct >= 50 returns 🌧️ regardless of day/night', () => {
    for (const hour of DAY_HOURS.concat(NIGHT_HOURS)) {
      const isNight = hour >= 20 || hour < 5;
      expect(pickHourlyEmoji({ rainPct: 60, cloudPct: 30, tempC: 18, isNight })).toBe('🌧️');
    }
  });

  it('rainPct >= 30 (rain-possible) differs day vs night', () => {
    for (const hour of DAY_HOURS) {
      expect(pickHourlyEmoji({ rainPct: 35, cloudPct: 30, tempC: 18, isNight: false })).toBe('🌦️');
    }
    for (const hour of NIGHT_HOURS) {
      expect(pickHourlyEmoji({ rainPct: 35, cloudPct: 30, tempC: 18, isNight: true })).toBe('🌧️');
    }
  });

  it('tc >= 35 returns 🔥 day and night', () => {
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 10, tempC: 36, isNight: false })).toBe('🔥');
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 10, tempC: 36, isNight: true })).toBe('🔥');
  });

  it('cloudPct >= 70 returns ☁️ day and night', () => {
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 80, tempC: 18, isNight: false })).toBe('☁️');
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 80, tempC: 18, isNight: true })).toBe('☁️');
  });

  it('cloudPct >= 40 (partly cloudy) differs day vs night', () => {
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 50, tempC: 18, isNight: false })).toBe('⛅');
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 50, tempC: 18, isNight: true })).toBe('☁️');
  });

  it('tc <= 10 returns ❄️ when no rain/cloud signal', () => {
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 10, tempC: 8, isNight: false })).toBe('❄️');
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 10, tempC: 8, isNight: true })).toBe('❄️');
  });

  it('clear fallback returns ☀️ by day and 🌙 by night', () => {
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 10, tempC: 22, isNight: false })).toBe('☀️');
    expect(pickHourlyEmoji({ rainPct: 0, cloudPct: 10, tempC: 22, isNight: true })).toBe('🌙');
  });
});

// ---------------------------------------------------------------------------
// 5) Full hour-by-hour sweep — verify that for every hour 0-23, no condition
//    that's supposed to be cloud-only or rain-only ever emits a daytime-only
//    glyph during night hours.
// ---------------------------------------------------------------------------
describe('hour-by-hour sweep: no daytime-only glyphs at night', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const isNight = hour >= 20 || hour < 5;
    const isDay = !isNight;
    for (const condition of CONDITIONS) {
      it(`hour ${String(hour).padStart(2, '0')} ${condition} isDay=${isDay} → no sun glyph at night`, () => {
        const glyph = pickConditionEmojiForTime(condition, isDay);
        if (isNight) {
          expect(DAYTIME_ONLY_GLYPHS.has(glyph)).toBe(false);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 6) Map contract — every entry has both day and night glyphs, and unknown
//    keys still produce a sane fallback.
// ---------------------------------------------------------------------------
describe('emoji map contract', () => {
  it('every condition entry has both day and night glyphs', () => {
    for (const [key, pair] of Object.entries(__WEATHER_EMOJI_MAP)) {
      expect(pair.day, `${key}.day`).toBeTruthy();
      expect(pair.night, `${key}.night`).toBeTruthy();
    }
  });

  it('unknown condition keys fall back without crashing', () => {
    expect(pickConditionEmojiForTime('martian-dust-devil', true)).toBeTruthy();
    expect(pickConditionEmojiForTime('martian-dust-devil', false)).toBeTruthy();
    expect(pickConditionEmojiForTime(null, true)).toBeTruthy();
    expect(pickConditionEmojiForTime(undefined, false)).toBeTruthy();
  });

  it('unknown condition fallback at night is not a sun glyph', () => {
    expect(DAYTIME_ONLY_GLYPHS.has(pickConditionEmojiForTime('whatever', false))).toBe(false);
  });
});
