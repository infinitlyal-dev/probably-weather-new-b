// Part B item 6 (8 Oct 2026): Open-Meteo and WeatherAPI are the same ECMWF forecast. When only those two put the hour
// at 30 % or more, the hero's probability "Might rain." is one forecast counted twice: it needs one other source at the
// line too. Harness (review/accuracy/results/might-rain-twins-harness.md): 204 twins-only hours, wet 30 %; 92 with another
// source, wet 47 %. The stats row keeps the blended number.

import { describe, expect, it } from 'vitest';
import { deriveCondition, rainOthersAtLine, RAIN_POSSIBLE_NOW_MIN_PROB } from '../api/weather.js';

// A dry, overcast-ish afternoon at 36 % blended: nothing above the might-rain rung fires.
const HOUR = {
  now: true, precipMm: 0.1, rainVotes: 0, gustKph: 18, desc: 'Partly cloudy', rainChance: 36, tempC: 19, feelsLikeC: 19,
  windKph: 9, uvIndex: 1, cloudPct: 45, maxWindKph: 18, isDay: true, dailyHighC: 22, dailyLowC: 12,
  sourceDescs: ['Partly cloudy', 'Partly cloudy', 'Partly cloudy', 'Partly cloudy'],
};

describe('the ECMWF twins alone do not hold "Might rain."', () => {
  it('36 % held only by Open-Meteo and WeatherAPI is not "Might rain."', () => {
    const r = deriveCondition({ ...HOUR, rainOthersAt30: 0 });
    expect(r.key).not.toBe('rain-possible');
  });

  it('...it falls to the next rung as any dry hour would (here partly cloudy)', () => {
    expect(deriveCondition({ ...HOUR, rainOthersAt30: 0 })).toEqual(deriveCondition({ ...HOUR, rainChance: 10 }));
  });

  it('with one other source at 30 % it is "Might rain." as before', () => {
    expect(deriveCondition({ ...HOUR, rainOthersAt30: 1 })).toEqual({ key: 'rain-possible', reason: 'rain-possible-prob' });
  });

  it('inputs cached before the count existed keep the old rule', () => {
    expect(deriveCondition(HOUR)).toEqual({ key: 'rain-possible', reason: 'rain-possible-prob' });
  });

  it('the rungs above it do not read the count: "Showers nearby." still stands on the twins', () => {
    const r = deriveCondition({ ...HOUR, rainChance: 65, precipMm: 0.5, rainVotes: 2, rainOthersAt30: 0 });
    expect(r).toEqual({ key: 'rain-possible', reason: 'showers-nearby' });
  });
});

describe('rainOthersAtLine counts the sources that are not the ECMWF twins', () => {
  const h = (source, pct) => ({ source, rains: [pct] });
  it('Open-Meteo and WeatherAPI never count', () => {
    expect(rainOthersAtLine([h('Open-Meteo', 80), h('WeatherAPI', 70), h('MET Norway', 10), h('Tomorrow.io', 20)], 0)).toBe(0);
  });
  it('MET Norway and Tomorrow.io count at the line', () => {
    expect(rainOthersAtLine([h('Open-Meteo', 40), h('WeatherAPI', 40), h('MET Norway', RAIN_POSSIBLE_NOW_MIN_PROB), h('Tomorrow.io', 45)], 0)).toBe(2);
  });
  it('missing slots and missing hours are skipped', () => {
    expect(rainOthersAtLine([null, h('WeatherAPI', 40), { source: 'Tomorrow.io', rains: [] }, h('MET Norway', null)], 0)).toBe(0);
  });
});
