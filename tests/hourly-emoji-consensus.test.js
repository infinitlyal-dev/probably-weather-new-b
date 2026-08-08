import { describe, expect, it } from 'vitest';
import { pickHourlyIcon, pickConditionIconForTime } from '../assets/weather-emoji.js';
import { deriveCondition } from '../api/weather.js';

// ---------------------------------------------------------------------------
// Regression: hourly emoji must agree with the consensus condition.
//
// Bug (Al, 2026-05-19, Strand): the home hero correctly read "Effens bewolk"
// (partly cloudy) but the hourly forecast emojis 09:00-14:00 all rendered a
// bare `sun`. Root cause: pickHourlyIcon used a 40% partly-cloudy floor while
// deriveCondition() (the consensus engine driving the home hero) uses 30%.
// The 30-39% cloud band was a dead zone — home said "partly cloudy", hourly
// said "clear".
//
// The old emoji tests missed this because they only probed cloudPct = 50 and
// 80, never the 30-39% gap.
// ---------------------------------------------------------------------------

describe('hourly emoji — the partly-cloudy dead zone (the 2026-05-19 bug)', () => {
  it('cloudCover 35%, no rain, daytime → `cloud-sun` (was `sun` under the old 40% floor)', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 35, tempC: 19, isNight: false })).toBe('cloud-sun');
  });

  it('the screenshot case: rainChance 27%, cloudCover 50%, daytime → `cloud-sun`', () => {
    expect(pickHourlyIcon({ rainPct: 27, cloudPct: 50, tempC: 19, isNight: false })).toBe('cloud-sun');
  });

  it('the 09:00-14:00 case: no rain, cloudCover 60%, daytime → `cloud` (55%+ is mostly cloudy)', () => {
    // NOTE: deriveCondition classes 55%+ cloud as mostly-cloudy → conditionKey
    // 'cloudy'. The hourly icon matches that, so home and hourly agree.
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 60, tempC: 19, isNight: false })).toBe('cloud');
  });
});

describe('hourly emoji — cloud-cover band boundaries', () => {
  it('29% cloud → `sun` (just below the partly-cloudy floor)', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 29, tempC: 19, isNight: false })).toBe('sun');
  });

  it('30% cloud → `cloud-sun` (exactly at the partly-cloudy floor)', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 30, tempC: 19, isNight: false })).toBe('cloud-sun');
  });

  it('54% cloud → `cloud-sun`, 55% cloud → `cloud` (the partly/mostly cloudy boundary)', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 54, tempC: 19, isNight: false })).toBe('cloud-sun');
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 55, tempC: 19, isNight: false })).toBe('cloud');
  });

  it('85% cloud with light rain chance → `cloud`', () => {
    expect(pickHourlyIcon({ rainPct: 10, cloudPct: 85, tempC: 19, isNight: false })).toBe('cloud');
  });

  it('partly-cloudy band at night renders `cloud`, never the sun-behind-cloud `cloud-sun`', () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 35, tempC: 14, isNight: true })).toBe('cloud');
  });
});

describe('hourly emoji — rain bands (unchanged)', () => {
  it('rainChance 70% → `rain`', () => {
    expect(pickHourlyIcon({ rainPct: 70, cloudPct: 40, tempC: 18, isNight: false })).toBe('rain');
  });

  it('rainChance 35% → `rain-sun` daytime, `rain` night (rain-possible band)', () => {
    expect(pickHourlyIcon({ rainPct: 35, cloudPct: 60, tempC: 18, isNight: false })).toBe('rain-sun');
    expect(pickHourlyIcon({ rainPct: 35, cloudPct: 60, tempC: 18, isNight: true })).toBe('rain');
  });

  it('clear day: no rain, 10% cloud → `sun`', () => {
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: 22, isNight: false })).toBe('sun');
  });
});

describe('hourly emoji — per-hour condition short-circuits thunder and fog', () => {
  it("condition 'storm' → `storm`, overriding the cloud/rain ladder", () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 10, tempC: 20, isNight: false, condition: 'storm' })).toBe('storm');
  });

  it("condition 'thunder' → `storm`", () => {
    expect(pickHourlyIcon({ rainPct: 20, cloudPct: 50, tempC: 20, isNight: false, condition: 'thunder' })).toBe('storm');
  });

  it("condition 'fog' → `fog` even when cloud cover reads clear", () => {
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 5, tempC: 12, isNight: false, condition: 'fog' })).toBe('fog');
  });

  it("an unreliable 'clear' condition still falls through to the cloud ladder", () => {
    // categorizeDesc collapses "partly cloudy" descriptions into 'clear', so a
    // condition of 'clear' must NOT suppress a genuine partly-cloud reading.
    expect(pickHourlyIcon({ rainPct: 0, cloudPct: 40, tempC: 19, isNight: false, condition: 'clear' })).toBe('cloud-sun');
  });
});

// ---------------------------------------------------------------------------
// Parity guard: the hourly icon's cloud bands must track deriveCondition() —
// the consensus engine behind the home hero. If someone shifts a threshold in
// one place and not the other, this fails.
// ---------------------------------------------------------------------------
describe('hourly emoji — parity with deriveCondition cloud bands', () => {
  const cloudKeyToGlyph = (key) => pickConditionIconForTime(key, true);

  for (const cloudPct of [0, 10, 20, 29, 30, 40, 54, 55, 70, 85, 100]) {
    it(`cloudPct ${cloudPct}: hourly icon matches deriveCondition's consensus key`, () => {
      // Neutral inputs so only the cloud band decides the condition.
      const consensus = deriveCondition({
        desc: '', rainChance: 0, tempC: 20, feelsLikeC: 20,
        windKph: 0, uvIndex: 0, cloudPct, isDay: true,
      });
      const expected = cloudKeyToGlyph(consensus.key);
      const actual = pickHourlyIcon({ rainPct: 0, cloudPct, tempC: 20, isNight: false });
      expect(actual).toBe(expected);
    });
  }
});
