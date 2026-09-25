// Condition incident, Strand, 22 September 2026 (review/condition-incident-20260922).
//
// The hero said "Rain's here." over a rain photograph while the same screen said
// "Rain Possible" and four of five sources said "Partly cloudy". Two rules made a
// probability into rain falling: the server's `rainChance >= 30 → rain` and the
// frontend's four-hour max `>= 50 → rain`. This file is the guard that fails if
// the hero and the stats on the same screen contradict each other again, and it
// pins the now-ladder's evidence rule and the wind rule that replaced them.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deriveCondition, applyVoteConsensus,
  RAIN_NOW_MIN_VOTES, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM, RAIN_POSSIBLE_NOW_MIN_PROB,
  WIND_NOW_MEAN_KPH, WIND_NOW_GUST_KPH,
} from '../api/weather.js';

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
const rainStatWord = new Function(`${sliceFn('rainStatWord')}; return rainStatWord;`)();

const incident = JSON.parse(readFileSync(new URL('../review/condition-incident-20260922/deployed-api.json', import.meta.url), 'utf8'));

const statsWord = (norm) => rainStatWord(norm.rainPct, (norm.daily?.[0]?.conditionKey || '').toLowerCase(), norm.rainLater);

describe('hero vs stats consistency — the 22 September 2026 payload', () => {
  it('can no longer paint "Rain\'s here." at 16:00, nor at 15:00 when the four-hour window held the 57% hours', () => {
    expect(incident.now.conditionKey).toBe('rain');                 // what production served
    expect(incident.now.conditionReason).toBe('moderate-rain-prob');
    for (const localHour of [15, 16]) {
      const norm = normalizePayload({ ...incident, meta: { ...incident.meta, localHour } });
      const display = computeHomeDisplayCondition(norm);
      expect(display, `localHour ${localHour}`).not.toBe('rain');
      expect(['rain-possible', 'cloudy', 'partly-cloudy', 'clear']).toContain(display);
      // and the word beside it agrees: "Might rain." sits next to Possible / Likely, never Unlikely.
      if (display === 'rain-possible') expect(['possible', 'likely', 'later', 'possibleLater']).toContain(statsWord(norm));
    }
  });

  it('the same screen never says rain beside Unlikely/None, nor might-rain beside None', () => {
    // A grid over what the server can send and what the next four hours can hold.
    const votesFor = (n) => ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io']
      .map((source, i) => ({ source, desc: i < n ? 'Rain' : 'Partly cloudy', vote: i < n ? 'rain' : 'clear' }));
    const servers = [
      { conditionKey: 'rain', conditionReason: 'rain-now' },
      { conditionKey: 'rain', conditionReason: 'tomorrow-io-radar-override' },
      { conditionKey: 'rain', conditionReason: 'moderate-rain-prob' },   // a pre-fix cached payload
      { conditionKey: 'rain', conditionReason: 'heavy-rain-prob' },
      { conditionKey: 'rain-possible', conditionReason: 'rain-possible-prob' },
      { conditionKey: 'rain-possible', conditionReason: 'desc-rain-unconfirmed' },
      { conditionKey: 'cloudy', conditionReason: 'overcast' },
      { conditionKey: 'partly-cloudy', conditionReason: 'partly-cloudy' },
      { conditionKey: 'clear', conditionReason: 'fallback-clear' },
      { conditionKey: 'wind', conditionReason: 'gust-wind' },
      { conditionKey: 'uv', conditionReason: 'moderate-uv-with-temp-gate' },
    ];
    let checked = 0;
    for (const server of servers) for (const nowRain of [5, 25, 45, 65, 85]) for (const next of [0, 20, 40, 60]) for (const votes of [0, 1, 2, 5]) for (const dailyRain of [10, 49, 70]) for (const daily0Key of ['clear', 'rain', 'rain-possible']) {
      const hourly = Array.from({ length: 48 }, (_, i) => ({ rainChance: i === 12 ? nowRain : (i > 12 && i < 16 ? next : 5), uv: 3, cloudPct: 40 }));
      const evidenced = server.conditionReason === 'rain-now' || server.conditionReason === 'tomorrow-io-radar-override';
      const payload = {
        ok: true,
        now: { tempC: 20, feelsLikeC: 20, windKph: 10, humidity: 60, rainChance: evidenced ? Math.max(nowRain, 60) : nowRain, uv: 3, cloudPct: 40, isDay: true,
          conditionKey: server.conditionKey, conditionReason: server.conditionReason, conditionLabel: 'x', conditionSignals: { overrides: [] } },
        daily: [{ highC: 24, lowC: 12, rainChance: dailyRain, uvMax: 6, conditionKey: daily0Key }],
        hourly,
        meta: { schema: CLIENT_SCHEMA_MIN, localHour: 12, sources: [], sourceConditions: votesFor(votes) },
      };
      const norm = normalizePayload(payload);
      const display = computeHomeDisplayCondition(norm);
      const word = statsWord(norm);
      checked++;
      if (display === 'rain') {
        expect(evidenced, `rain shown without evidence: ${JSON.stringify(server)} nowRain=${nowRain} next=${next} votes=${votes}`).toBe(true);
        expect(['likely', 'later']).toContain(word);
      }
      if (display === 'rain-possible') expect(['possible', 'likely', 'possibleLater', 'later'], `might-rain beside "${word}"`).toContain(word);
      if (word === 'none' || word === 'unlikely') expect(['rain', 'rain-possible']).not.toContain(display);
    }
    expect(checked).toBeGreaterThan(5000);
  });
});

describe('server now-ladder: rain needs evidence, wind beats might-rain', () => {
  const base = { now: true, desc: 'Partly cloudy', tempC: 20, feelsLikeC: 20, windKph: 10, gustKph: 20, uvIndex: 2, cloudPct: 50, isDay: true, dailyHighC: 24, dailyLowC: 12, sourceDescs: [] };

  it('probability alone never yields rain; the three evidence gates together do', () => {
    for (const rainChance of [20, 29, 30, 45, 59, 60, 75, 100]) for (const rainVotes of [0, 1, 2, 5]) for (const precipMm of [0, 0.1, 0.3, 2]) {
      const r = deriveCondition({ ...base, rainChance, rainVotes, precipMm });
      const evidenced = rainVotes >= RAIN_NOW_MIN_VOTES && rainChance >= RAIN_NOW_MIN_PROB && precipMm >= RAIN_NOW_MIN_MM;
      expect(r.key === 'rain', `rainChance=${rainChance} votes=${rainVotes} mm=${precipMm} → ${r.key}/${r.reason}`).toBe(evidenced);
      if (evidenced) expect(r.reason).toBe('rain-now');
      if (!evidenced && rainChance >= RAIN_POSSIBLE_NOW_MIN_PROB) expect(r.key).toBe('rain-possible');
      if (!evidenced && rainChance < RAIN_POSSIBLE_NOW_MIN_PROB) expect(['rain', 'rain-possible']).not.toContain(r.key);
    }
  });

  it('the incident\'s own selector inputs resolve to might-rain, not rain', () => {
    const inputs = incident.now.conditionSignals.selector.inputs;
    const r = deriveCondition({ ...inputs, now: true, precipMm: incident.hourly[16].precipMm, rainVotes: 0, gustKph: 20.1 });
    expect(r).toEqual({ key: 'rain-possible', reason: 'rain-possible-prob' });
  });

  it('a fresh breeze beats might-rain, overcast and high UV; rain now beats wind', () => {
    const windy = { ...base, desc: 'Overcast', rainChance: 45, uvIndex: 9, cloudPct: 90, rainVotes: 1, precipMm: 0 };
    expect(deriveCondition({ ...windy, windKph: WIND_NOW_MEAN_KPH, gustKph: 10 })).toEqual({ key: 'wind', reason: 'sustained-wind' });
    expect(deriveCondition({ ...windy, windKph: 12, gustKph: WIND_NOW_GUST_KPH })).toEqual({ key: 'wind', reason: 'gust-wind' });
    expect(deriveCondition({ ...windy, windKph: 12, gustKph: WIND_NOW_GUST_KPH - 1 }).key).not.toBe('wind');
    // 2026-09-25: the strict cell (≥ 90 %, ≥ 2 mm) — 80 % and 1.2 mm is now a demoted hour, and wind outranks it.
    expect(deriveCondition({ ...windy, windKph: 40, gustKph: 70, rainVotes: 3, rainChance: 92, precipMm: 2.4 })).toEqual({ key: 'rain', reason: 'rain-now' });
    expect(deriveCondition({ ...windy, windKph: 40, gustKph: 70, rainVotes: 3, rainChance: 80, precipMm: 1.2 })).toEqual({ key: 'wind', reason: 'sustained-wind' });
  });

  it('the daily ladder is unchanged: a 45% day is a rain day, a 25% day is might-rain', () => {
    expect(deriveCondition({ desc: 'Partly cloudy', rainChance: 45, tempC: 24, windKph: 10, uvIndex: 5, cloudPct: 50, isDay: true })).toEqual({ key: 'rain', reason: 'moderate-rain-prob' });
    expect(deriveCondition({ desc: 'Partly cloudy', rainChance: 25, tempC: 24, windKph: 10, uvIndex: 5, cloudPct: 50, isDay: true })).toEqual({ key: 'rain-possible', reason: 'rain-possible-prob' });
  });

  it('the vote guard leaves a probability might-rain alone and still demotes a lone description', () => {
    const norms = [{ source: 'Open-Meteo' }, { source: 'WeatherAPI' }, { source: 'Pirate Weather' }, { source: 'MET Norway' }, { source: 'Tomorrow.io' }];
    const votes = [{ source: 'Open-Meteo', vote: 'clear' }, { source: 'WeatherAPI', vote: 'rain', desc: 'Patchy rain possible' }, { source: 'Pirate Weather', vote: 'clear' }, { source: 'MET Norway', vote: 'clear' }, { source: 'Tomorrow.io', vote: 'clear' }];
    expect(applyVoteConsensus({ key: 'rain-possible', reason: 'rain-possible-prob', activeNorms: norms, sourceVotes: votes }).key).toBe('rain-possible');
    expect(applyVoteConsensus({ key: 'rain-possible', reason: 'desc-rain-unconfirmed', activeNorms: norms, sourceVotes: votes }).key).toBe('clear');
  });

  it('wind consensus counts a gust: two sources at 44+ km/h gust keep the headline', () => {
    const norms = [
      { source: 'Open-Meteo', windKph: 15, gustKph: 58 },
      { source: 'WeatherAPI', windKph: 14, gustKph: 46 },
      { source: 'Pirate Weather', windKph: 12, gustKph: 30 },
      { source: 'MET Norway', windKph: 13, gustKph: null },
      { source: 'Tomorrow.io', windKph: 11, gustKph: null },
    ];
    expect(applyVoteConsensus({ key: 'wind', reason: 'gust-wind', activeNorms: norms, sourceVotes: [] }).key).toBe('wind');
    norms[1].gustKph = 30;
    expect(applyVoteConsensus({ key: 'wind', reason: 'gust-wind', activeNorms: norms, sourceVotes: [] }).key).toBe('clear');
  });
});
