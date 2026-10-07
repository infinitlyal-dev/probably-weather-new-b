// Breezy (Al, 7 Oct 2026): a clear or partly-cloudy sky with a wind people notice that is not Windy.
// Line picked on the harness (review/accuracy/breezy-sweep.mjs): mean ≥ 15 km/h on the number the Windy rung reads,
// or a gust ≥ 30, under the Windy line, with at least two sources' own wind at the line. Rain, storm, fog, cold, heat
// and Windy outrank it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveCondition, BREEZY_MEAN_KPH, BREEZY_GUST_KPH, BREEZY_MIN_SOURCES } from '../api/weather.js';
import { pickHourlyIcon } from '../assets/weather-emoji.js';

// A Gqeberha-style mild afternoon: clear sky, 18 km/h, two sources at the line.
const base = { now: true, desc: 'Clear sky', rainChance: 5, precipMm: 0, rainVotes: 0, tempC: 21, feelsLikeC: 21, windKph: 18,
  windThresholdKph: 25, gustKph: 26, gustLineKph: 55, uvIndex: 4, cloudPct: 20, isDay: true, dailyHighC: 23, dailyLowC: 13, breezySources: 2 };

describe('breezy — the now ladder', () => {
  it('the constants are the harness pick', () => {
    expect([BREEZY_MEAN_KPH, BREEZY_GUST_KPH, BREEZY_MIN_SOURCES]).toEqual([15, 30, 2]);
  });
  it('clear sky, 18 km/h, two sources → Breezy', () => {
    expect(deriveCondition(base)).toEqual({ key: 'breezy', reason: 'breezy' });
  });
  it('partly cloudy counts as a clear-family sky', () => {
    expect(deriveCondition({ ...base, cloudPct: 45 }).key).toBe('breezy');
  });
  it('a gust of 30 with a light mean → Breezy', () => {
    expect(deriveCondition({ ...base, windKph: 10, gustKph: 32 }).key).toBe('breezy');
  });
  it('one source at the line is not enough (an overcooked WeatherAPI cannot trip it)', () => {
    expect(deriveCondition({ ...base, breezySources: 1 }).key).not.toBe('breezy');
  });
  it('under the line → not Breezy', () => {
    expect(deriveCondition({ ...base, windKph: 14, gustKph: 25 }).key).not.toBe('breezy');
  });
  it('at the Windy line it is Windy, not Breezy', () => {
    expect(deriveCondition({ ...base, windKph: 26 }).key).toBe('wind');
  });
  it('a grey sky stays Cloudy', () => {
    expect(deriveCondition({ ...base, cloudPct: 70 }).key).toBe('cloudy');
  });
  it('rain, fog, cold and heat outrank it', () => {
    expect(deriveCondition({ ...base, rainChance: 40 }).key).toBe('rain-possible');
    expect(deriveCondition({ ...base, desc: 'Fog' }).key).toBe('fog');
    expect(deriveCondition({ ...base, tempC: 8, feelsLikeC: 5, dailyHighC: 12, cloudPct: 40 }).key).toBe('cold');
    expect(deriveCondition({ ...base, tempC: 31, feelsLikeC: 31 }).key).toBe('heat');
  });
  it('a caller that does not count sources never gets Breezy', () => {
    const { breezySources, ...rest } = base;
    expect(deriveCondition(rest).key).not.toBe('breezy');
  });
});

describe('breezy — the day ladder', () => {
  it('noon wind 18 with two sources → Breezy; the gust route is the hero\'s only', () => {
    const day = { desc: 'Clear sky', rainChance: 5, tempC: 23, windKph: 18, uvIndex: 5, cloudPct: 20, isDay: true, dailyHighC: 23, dailyLowC: 12, breezySources: 2 };
    expect(deriveCondition(day).key).toBe('breezy');
    expect(deriveCondition({ ...day, windKph: 10, gustKph: 40 }).key).not.toBe('breezy');
    expect(deriveCondition({ ...day, windKph: 27 }).key).toBe('wind');
  });
});

describe('breezy — the phone', () => {
  const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const slice = (name) => { const s = js.indexOf(`function ${name}(`); return js.slice(s, js.indexOf('\n  }', s) + 4); };
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const sky = new Function('isNum', 'debugLog', `${slice('computeSkyCondition')}; return computeSkyCondition;`)(isNum, () => {});
  const home = new Function('isNum', 'debugLog', 'computeSkyCondition', 'THRESH', `${slice('computeHomeDisplayCondition')}; return computeHomeDisplayCondition;`)(isNum, () => {}, sky, { HOT_C: 35 });
  const norm = { conditionKey: 'breezy', rainPct: 5, windKph: 18, cloudPct: 20, isDay: true, todayHigh: 23, sourceConditions: [] };
  it('shows the server\'s Breezy', () => { expect(home(norm)).toBe('breezy'); });
  it('rain later outranks it', () => { expect(home({ ...norm, rainLater: true })).toBe('rain-possible'); });
  it('a breezy hour draws the wind glyph', () => {
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 20, tempC: 20, isNight: false, condition: 'breezy' })).toBe('wind');
  });
});
