// Al's rain / fog ruling, 25 September 2026 (review/rain-fog-frost-ruled.json, ruled in chat).
//
// 1. "Rain's here" is the strict cell in EVERY region — ≥ 2 sources describing rain, ≥ 90 % and ≥ 2 mm
//    for this hour — exactly as replayed in review/accuracy/v3/rainnow.mjs. Tomorrow.io's radar override
//    is unchanged (the replay could not see it).
// 2. An hour the old rule (≥ 60 %, ≥ 0.3 mm) called "Rain's here" and the strict rule does not says
//    "Showers nearby." where "Might rain." would be — in all five languages.
// 3. Fog's strict gates in exactly the five regions Al said YES to.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deriveCondition, applyVoteConsensus,
  RAIN_NOW_MIN_VOTES, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM,
  SHOWERS_NEARBY_MIN_PROB, SHOWERS_NEARBY_MIN_MM, FOG_STRICT_REGIONS,
} from '../api/weather.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const ruled = JSON.parse(readFileSync(new URL('../review/rain-fog-frost-ruled.json', import.meta.url), 'utf8'));
const verdict = (key) => ruled.questions.find((q) => q.key === key)?.verdict;
const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing from app.js`).toBeGreaterThan(-1);
  return js.slice(start, js.indexOf('\n  }', start) + 4);
};
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const noop = () => {};
const CLIENT_SCHEMA_MIN = Number(js.match(/const PAYLOAD_SCHEMA_MIN = (\d+);/)[1]);
const normalizePayload = new Function('isNum', 'debugLog', 'PAYLOAD_SCHEMA_MIN', `${sliceFn('normalizePayload')}; return normalizePayload;`)(isNum, noop, CLIENT_SCHEMA_MIN);
const computeSkyCondition = new Function('isNum', 'debugLog', `${sliceFn('computeSkyCondition')}; return computeSkyCondition;`)(isNum, noop);
const computeHomeDisplayCondition = new Function('isNum', 'debugLog', 'computeSkyCondition', `${sliceFn('computeHomeDisplayCondition')}; return computeHomeDisplayCondition;`)(isNum, noop, computeSkyCondition);

// The hero's description line, exactly as renderHome writes it (sliced from the source, not re-typed).
const descExpr = js.match(/safeText\(descriptionEl, (displayConditionForCopy === 'rain-possible' && norm\.showersNearby[\s\S]*?getHeadline\(displayConditionForCopy\))\);/);
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const leaf = js.match(/showersNearby: (\{ en: "[^"]*", af: "[^"]*", zu: "[^"]*", xh: "[^"]*", st: "[^"]*" \})/);
const SHOWERS = leaf ? new Function(`return ${leaf[1]};`)() : null;
const describeHero = (lang, displayConditionForCopy, norm) => new Function('displayConditionForCopy', 'norm', 't', 'getHeadline', `return ${descExpr[1]};`)(
  displayConditionForCopy, norm,
  (cat, key) => (cat === 'weather' && key === 'showersNearby' ? SHOWERS[lang] : `?${cat}.${key}`),
  (c) => WEATHER_COPY.headlines[c][lang],
);

const now = (o) => deriveCondition({ now: true, desc: 'Moderate rain', tempC: 17, feelsLikeC: 17, windKph: 12, gustKph: 30, uvIndex: 1, cloudPct: 90, isDay: true, dailyHighC: 19, ...o });

describe('the ruling on disk', () => {
  it('Al ruled strict everywhere, all five fog regions, and the wording', () => {
    expect(verdict('rain-proven')).toBe('STRICT');
    expect(verdict('rain-rest')).toBe('STRICT');
    expect(verdict('wording')).toBe('OK');
    for (const k of ['fog-wc', 'fog-gr', 'fog-ec', 'fog-kzn', 'fog-lv']) expect(verdict(k), k).toBe('YES');
  });
});

describe('"Rain\'s here" — the strict cell, as tested', () => {
  it('pins the thresholds rainnow.mjs replayed: votes 2 (not tuned), ≥ 90 %, ≥ 2 mm; the old cell for Showers nearby', () => {
    expect([RAIN_NOW_MIN_VOTES, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM]).toEqual([2, 90, 2]);
    expect([SHOWERS_NEARBY_MIN_PROB, SHOWERS_NEARBY_MIN_MM]).toEqual([60, 0.3]);
  });

  it('says "Rain\'s here" only with two rain descriptions, ≥ 90 % and ≥ 2 mm', () => {
    expect(now({ rainVotes: 2, rainChance: 90, precipMm: 2 })).toEqual({ key: 'rain', reason: 'rain-now' });
    expect(now({ rainVotes: 4, rainChance: 97, precipMm: 6 })).toEqual({ key: 'rain', reason: 'rain-now' });
    expect(now({ rainVotes: 1, rainChance: 97, precipMm: 6 }).key).toBe('rain-possible');
    expect(now({ rainVotes: 2, rainChance: 89, precipMm: 6 }).key).toBe('rain-possible');
    expect(now({ rainVotes: 2, rainChance: 97, precipMm: 1.9 }).key).toBe('rain-possible');
  });

  it('the old rule\'s rain that strict demotes is "showers-nearby"; below the old cell it stays plain might-rain', () => {
    for (const [p, mm] of [[60, 0.3], [75, 1], [89, 5], [97, 1.9]]) expect(now({ rainVotes: 2, rainChance: p, precipMm: mm }), `${p}% ${mm} mm`).toEqual({ key: 'rain-possible', reason: 'showers-nearby' });
    expect(now({ rainVotes: 2, rainChance: 59, precipMm: 1 }).reason).not.toBe('showers-nearby');
    expect(now({ rainVotes: 2, rainChance: 70, precipMm: 0.2 }).reason).not.toBe('showers-nearby');
    expect(now({ rainVotes: 1, rainChance: 70, precipMm: 1 }).reason).not.toBe('showers-nearby');
  });

  it('wind still outranks a demoted hour (as replayed); strict rain still outranks wind', () => {
    expect(now({ rainVotes: 2, rainChance: 75, precipMm: 1, windKph: 30 }).key).toBe('wind');
    expect(now({ rainVotes: 2, rainChance: 75, precipMm: 1, gustKph: 60 }).key).toBe('wind');
    expect(now({ rainVotes: 2, rainChance: 95, precipMm: 3, windKph: 30 }).key).toBe('rain');
  });

  it('an answer cached under the old rule re-derives differently, so the cache refresh refuses it and refetches', () => {
    // refreshCachedPayload re-runs deriveCondition on the stored selector inputs and serves the entry only if
    // key AND reason are unchanged: a pre-ruling rain/rain-now at 75 % and 1 mm must not survive the deploy.
    const legacy = { base: { key: 'rain', reason: 'rain-now' }, inputs: { now: true, desc: 'Moderate rain', rainVotes: 2, rainChance: 75, precipMm: 1, tempC: 17, feelsLikeC: 17, windKph: 12, gustKph: 30, uvIndex: 1, cloudPct: 90, isDay: true, dailyHighC: 19 } };
    const rederived = deriveCondition(legacy.inputs);
    expect(rederived).toEqual({ key: 'rain-possible', reason: 'showers-nearby' });
    expect(rederived.key !== legacy.base.key || rederived.reason !== legacy.base.reason).toBe(true);
    expect(readFileSync(new URL('../api/weather.js', import.meta.url), 'utf8')).toMatch(/if \(rederived\.key !== selector\.base\.key \|\| rederived\.reason !== selector\.base\.reason\) \{/);
  });

  it('a showers-nearby answer read later, when the phone\'s window says the rain is later, stays plain might-rain', () => {
    const later = normalizePayload({
      ok: true, now: { tempC: 17, windKph: 12, cloudPct: 90, isDay: true, rainChance: 75, conditionKey: 'rain-possible', conditionReason: 'showers-nearby' },
      daily: [{ highC: 19, lowC: 12, rainChance: 70, conditionKey: 'rain' }],
      hourly: Array.from({ length: 48 }, (_, i) => ({ rainChance: i >= 11 && i <= 14 ? 10 : 75, uv: 1 })),
      meta: { localHour: 11, sources: [], sourceConditions: [] },
    });
    expect(later.rainLater).toBe(true);
    expect(later.showersNearby).toBe(false);
  });

  it('the vote-consensus guard keeps a showers-nearby hour (its two rain descriptions are weather votes)', () => {
    const activeNorms = [{}, {}, {}, {}, {}];
    const sourceVotes = [
      { source: 'Open-Meteo', desc: 'Moderate rain', vote: 'rain' }, { source: 'MET Norway', desc: 'Rain', vote: 'rain' },
      { source: 'WeatherAPI', desc: 'Partly cloudy', vote: 'clear' }, { source: 'Pirate Weather', desc: 'Clear', vote: 'clear' },
      { source: 'Tomorrow.io', desc: 'Clear', vote: 'clear' },
    ];
    expect(applyVoteConsensus({ key: 'rain-possible', reason: 'showers-nearby', activeNorms, sourceVotes })).toMatchObject({ key: 'rain-possible', reason: 'showers-nearby' });
  });
});

describe('the hero in five languages', () => {
  const payload = (reason, key, rainChance) => ({
    ok: true,
    now: { tempC: 17, windKph: 12, cloudPct: 90, isDay: true, rainChance, conditionKey: key, conditionReason: reason },
    daily: [{ highC: 19, lowC: 12, rainChance: 70, conditionKey: 'rain' }],
    hourly: Array.from({ length: 48 }, () => ({ rainChance, uv: 1 })),
    meta: { localHour: 10, sources: [], sourceConditions: [
      { source: 'Open-Meteo', desc: 'Moderate rain', vote: 'rain' }, { source: 'MET Norway', desc: 'Rain', vote: 'rain' },
      { source: 'WeatherAPI', desc: 'Overcast', vote: 'cloudy' }] },
  });

  it('the wording is wired in all five languages, EN and AF as Al OK\'d them', () => {
    expect(descExpr, 'renderHome no longer writes the description through the showers-nearby switch').not.toBeNull();
    expect(SHOWERS).not.toBeNull();
    expect(SHOWERS.en).toBe('Showers nearby.');
    expect(SHOWERS.af).toBe('Buie naby.');
    for (const l of LANGS) expect(SHOWERS[l], l).toMatch(/\S/);
    expect(new Set(LANGS.map((l) => SHOWERS[l])).size).toBe(5);
  });

  it('a showers-nearby payload says "Showers nearby." (not "Might rain.") in every language', () => {
    const r = deriveCondition({ now: true, desc: 'Moderate rain', rainVotes: 2, rainChance: 75, precipMm: 1, tempC: 17, feelsLikeC: 17, windKph: 12, gustKph: 30, uvIndex: 1, cloudPct: 90, isDay: true, dailyHighC: 19 });
    const norm = normalizePayload(payload(r.reason, r.key, 75));
    expect(norm.showersNearby).toBe(true);
    expect(computeHomeDisplayCondition(norm)).toBe('rain-possible');
    for (const l of LANGS) {
      expect(describeHero(l, 'rain-possible', norm), l).toBe(SHOWERS[l]);
      expect(describeHero(l, 'rain-possible', norm), l).not.toBe(WEATHER_COPY.headlines['rain-possible'][l]);
    }
  });

  it('a plain might-rain still says "Might rain.", and strict rain still says "Rain\'s here.", in every language', () => {
    const maybe = normalizePayload(payload('rain-possible-prob', 'rain-possible', 45));
    expect(maybe.showersNearby).toBe(false);
    const rain = normalizePayload(payload('rain-now', 'rain', 95));
    expect(computeHomeDisplayCondition(rain)).toBe('rain');
    for (const l of LANGS) {
      expect(describeHero(l, 'rain-possible', maybe), l).toBe(WEATHER_COPY.headlines['rain-possible'][l]);
      expect(describeHero(l, 'rain', rain), l).toBe(WEATHER_COPY.headlines.rain[l]);
    }
  });

  it('the switch only rewords might-rain: a showers-nearby payload the app shows as wind keeps the wind headline', () => {
    const norm = normalizePayload({ ...payload('showers-nearby', 'rain-possible', 75), now: { ...payload('showers-nearby', 'rain-possible', 75).now, windKph: 32 } });
    expect(computeHomeDisplayCondition(norm)).toBe('wind');
    for (const l of LANGS) expect(describeHero(l, 'wind', norm), l).toBe(WEATHER_COPY.headlines.wind[l]);
  });
});

describe('fog — strict gates in the five regions Al ruled YES', () => {
  it('FOG_STRICT_REGIONS is exactly those five, nothing waits behind a switch', () => {
    const REGION = { 'fog-wc': 'Western Cape', 'fog-gr': 'Garden Route', 'fog-ec': 'Eastern Cape', 'fog-kzn': 'KZN coast', 'fog-lv': 'Lowveld' };
    const yes = Object.entries(REGION).filter(([k]) => verdict(k) === 'YES').map(([, g]) => g);
    expect([...FOG_STRICT_REGIONS].sort()).toEqual(yes.sort());
    expect(FOG_STRICT_REGIONS).toHaveLength(5);
  });
});
