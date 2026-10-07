// Part B item 4 (Al, 7 Oct 2026): a description with "possible" in it is not a thunder vote, the same way
// rain votes already exclude it.
//
// Replay case — Bloemfontein airport, 29 Sept 2026, 13:10 SAST (live recorder): the four sources said
// "Partly cloudy", "Thundery outbreaks possible" (WeatherAPI), "Cloudy", "Light rain showers". The two-word
// rule made the hero Thunder; the airport reported FEW020 SCT025, nothing falling, no thunder. All 7 such
// Thunder heroes at airports from 24 Sept to 7 Oct were this shape (review/accuracy/results/thunder-possible.md).

import { describe, expect, it } from 'vitest';
import { deriveCondition } from '../api/weather.js';

// The selector inputs exactly as the live API recorded them (conditionSignals.selector.inputs).
const FABL_0929 = {
  now: true, precipMm: 0.1, rainVotes: 1, gustKph: 38.2, gustLineKph: 45, windSourcesAt25: 1, windSourcesMin: 0,
  desc: 'Light rain showers', rainChance: 34.9, tempC: 18.7, feelsLikeC: 16.9, windKph: 21.1, windThresholdKph: 27.5,
  uvIndex: 2.5, cloudPct: 66, maxWindKph: 38.2, isDay: true, dailyHighC: 19.4, dailyLowC: 8.6,
  sourceDescs: ['Partly cloudy', 'Thundery outbreaks possible', 'Cloudy', 'Light rain showers'],
};

describe('a "possible" is not a thunder vote', () => {
  it('Bloemfontein 29 Sept: "Thundery outbreaks possible" + one shower word is no longer Thunder', () => {
    const r = deriveCondition(FABL_0929);
    expect(r.key).not.toBe('thunder');
    expect(r.reason).not.toBe('two-source-consensus-thunder');
  });

  it('a plain thunder word with a rain word is still Thunder', () => {
    const r = deriveCondition({ ...FABL_0929, sourceDescs: ['Partly cloudy', 'Moderate or heavy rain with thunder', 'Cloudy', 'Light rain showers'] });
    expect(r).toEqual({ key: 'thunder', reason: 'two-source-consensus-thunder' });
  });

  it('a "possible" beside a real thunder word does not stop it', () => {
    const r = deriveCondition({ ...FABL_0929, sourceDescs: ['Thunderstorm', 'Thundery outbreaks possible', 'Cloudy', 'Light rain showers'] });
    expect(r.key).toBe('thunder');
  });
});
