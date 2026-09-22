// Replay of the app's own condition resolver over an archived ensemble.
//
// Two layers, both the REAL code:
//   server   — api/weather.js: weight adjustment, weighted blends, modal cloud,
//              weighted description vote, deriveCondition, and the post-vote
//              overrides in production order. deriveCondition / categorizeDesc /
//              pickWeightedMostCommon / pickModalCloud / detectAdvectionFog /
//              corroboratedFogUpgrade / isTrueFogDesc / countsAsWeatherVote are
//              IMPORTED from api/weather.js. The aggregation glue between them is
//              copied from the handler with the line numbers cited, because the
//              handler is one 2,000-line function and cannot be imported piecemeal.
//   frontend — assets/app.js computeHomeDisplayCondition / computeSkyCondition /
//              computeTodaysHero, sliced from the shipped file the way the unit
//              tests do, and fed a `norm` built the way normalizePayload builds it.
//
// Run it before and after a rule change and the difference is the rule change.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveCondition, applyVoteConsensus, categorizeDesc, pickWeightedMostCommon, pickModalCloud,
  detectAdvectionFog, corroboratedFogUpgrade, isTrueFogDesc, countsAsWeatherVote,
} from '../../../api/weather.js';
import { HEAT_WARM_C, HEAT_EXTREME_C } from '../../../assets/weather-thresholds.js';
import { ensembleAt } from './sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..', '..');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Frontend functions, sliced from assets/app.js (same technique as
// tests/rain-now-override-home.test.js). Re-read on every import so a source
// edit is picked up by the next run.
// ---------------------------------------------------------------------------
const appJs = readFileSync(path.join(REPO, 'assets', 'app.js'), 'utf8');
function sliceFn(name) {
  const start = appJs.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} missing from assets/app.js`);
  return appJs.slice(start, appJs.indexOf('\n  }', start) + 4);
}
const noop = () => {};
const THRESH = { RAIN_PCT: 40, WIND_KPH: 25, COLD_C: 16, HOT_C: HEAT_EXTREME_C };
const computeSkyCondition = new Function('isNum', 'debugLog', `${sliceFn('computeSkyCondition')}; return computeSkyCondition;`)(isNum, noop);
const computeHomeDisplayCondition = new Function('isNum', 'debugLog', 'computeSkyCondition', 'THRESH', `${sliceFn('computeHomeDisplayCondition')}; return computeHomeDisplayCondition;`)(isNum, noop, computeSkyCondition, THRESH);
const computeTodaysHero = new Function('isNum', 'debugLog', 'THRESH', 'HEAT_EXTREME_C', `${sliceFn('computeTodaysHero')}; return computeTodaysHero;`)(isNum, noop, THRESH, HEAT_EXTREME_C);

// ---------------------------------------------------------------------------
// Handler glue (api/weather.js), copied with citations.
// ---------------------------------------------------------------------------
// :856  base weights; :1861–1897 dedup + MET boost; :1898–1903 hourly weights.
function adjustedWeights(norms, lat, lon) {
  const W = [0.30, 0.22, 0.13, 0.20, 0.15];
  if (isNum(norms[0]?.todayHigh) && isNum(norms[1]?.todayHigh)) {
    if (Math.abs(norms[0].todayHigh - norms[1].todayHigh) <= 0.5) W[1] = W[1] / 2;
  }
  const isHighveld = lat > -28 && lon > 25;
  if (isNum(norms[3]?.todayHigh) && !isHighveld) {
    const fam = [norms[0]?.todayHigh, norms[1]?.todayHigh].filter(isNum);
    if (fam.length) {
      const avg = fam.reduce((a, b) => a + b, 0) / fam.length;
      if (norms[3].todayHigh - avg > 5) { W[0] = 0.25; W[3] = 0.40; }
    }
  }
  const hBase = [W[0], W[1], W[3], W[4]];
  const hTotal = hBase.reduce((a, b) => a + b, 0);
  return { W, HW: hBase.map((w) => w / hTotal) };
}
// :1912–1926
function resolveWeights(arr, baseWeights) {
  const active = arr.map((item, i) => (item != null ? (baseWeights[i] ?? 0) : 0));
  const total = active.reduce((s, v) => s + v, 0);
  if (total === 0) {
    const count = arr.filter(Boolean).length;
    const eq = count > 0 ? 1 / count : 0;
    return arr.map((item) => (item != null ? eq : 0));
  }
  return active.map((v) => v / total);
}
// :1955–1963
function wAvg(arr, weights, getter) {
  let sum = 0, wSum = 0;
  arr.forEach((item, i) => {
    if (item == null) return;
    const v = getter(item);
    if (isNum(v)) { sum += v * weights[i]; wSum += weights[i]; }
  });
  return wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
}
const DESC_WEIGHTS = [1, 0.1, 1, 1, 1];        // :2044
const HOURLY_DESC_WEIGHTS = [1, 0.1, 1, 1];    // :1970

// :1973–2041 aggregatedHourly (the fields the decision reads)
function aggregateHourly(hourlies, hourlyW) {
  return Array.from({ length: 48 }, (_, i) => {
    const cloudEntries = hourlies.map((h, si) => (h && isNum(h.clouds?.[i]) ? { value: h.clouds[i], weight: hourlyW[si] } : null)).filter(Boolean);
    const modalCloud = cloudEntries.length ? pickModalCloud(cloudEntries.map((e) => e.value), cloudEntries.map((e) => e.weight)) : null;
    const descEntries = hourlies.map((h, si) => (h && h.descs?.[i] ? { desc: h.descs[i], weight: HOURLY_DESC_WEIGHTS[si] } : null)).filter(Boolean);
    const winningDesc = descEntries.length ? pickWeightedMostCommon(descEntries) : null;
    const uvVal = wAvg(hourlies, hourlyW, (h) => h.uvs?.[i]);
    return {
      tempC: wAvg(hourlies, hourlyW, (h) => h.temps[i]),
      rainChance: wAvg(hourlies, hourlyW, (h) => h.rains[i]),
      precipMm: wAvg(hourlies, hourlyW, (h) => h.precipMm?.[i]),
      windKph: wAvg(hourlies, hourlyW, (h) => h.winds[i]),
      cloudPct: modalCloud,
      uv: isNum(uvVal) ? Math.round(uvVal * 10) / 10 : null,
      condition: winningDesc ? categorizeDesc(winningDesc) : null,
      descLabel: winningDesc,
    };
  });
}

// :2046–2160 daily[0] as the now-path reads it (highC/lowC/rainChance) plus the
// daily condition ladder + Rec-4 / fog / B-2 daily overrides, for the day table.
function aggregateDaily0(dailies, dailyW, aggregatedHourly) {
  const i = 0;
  const descEntries = dailies.map((d, si) => (d && d.descs[i] ? { desc: d.descs[i], weight: DESC_WEIGHTS[si] } : null)).filter(Boolean);
  const conditionLabel = pickWeightedMostCommon(descEntries) || 'Unknown';
  const highC = wAvg(dailies, dailyW, (d) => d.highs[i]);
  const lowC = wAvg(dailies, dailyW, (d) => d.lows[i]);
  const rainChance = wAvg(dailies, dailyW, (d) => d.rains[i]);
  const uv = wAvg(dailies, dailyW, (d) => d.uvs[i]);
  const noonIdx = 12;
  const windKph = aggregatedHourly[noonIdx]?.windKph ?? wAvg(dailies, dailyW, (d) => d.winds?.[i]);
  const cloudPct = aggregatedHourly[noonIdx]?.cloudPct ?? wAvg(dailies, dailyW, (d) => d.clouds?.[i]);
  const sourceDescs = dailies.map((dd) => dd?.descs?.[i]).filter(Boolean);
  let { key, reason } = deriveCondition({ desc: conditionLabel, rainChance, tempC: highC, windKph, uvIndex: uv, cloudPct, isDay: true, dailyLowC: lowC, dailyHighC: highC, sourceDescs });
  const overrides = [];
  if ((key === 'rain-possible' || key === 'cloudy') && descEntries.length >= 3) {
    const votes = descEntries.map((e) => categorizeDesc(e.desc));
    const n = votes.filter(countsAsWeatherVote).length;
    const omRain = dailies[0]?.descs?.[i] && categorizeDesc(dailies[0].descs[i]) === 'rain';
    const metRain = dailies[3]?.descs?.[i] && categorizeDesc(dailies[3].descs[i]) === 'rain';
    if (n < 2 && !(omRain || metRain)) { overrides.push('majority-override-clear'); key = 'clear'; reason = 'majority-override-clear'; }
  }
  if (key === 'fog' && descEntries.length >= 2) {
    const fogN = dailies.filter((d) => d && d.descs[i] && categorizeDesc(d.descs[i]) === 'fog').length;
    if (fogN < 2) { const to = isNum(cloudPct) && cloudPct >= 55 ? 'cloudy' : isNum(cloudPct) && cloudPct >= 30 ? 'partly-cloudy' : 'clear'; overrides.push('fog-blocked'); key = to; reason = 'fog-blocked-insufficient-corroboration'; }
  }
  const preds = {
    storm: (d) => d && categorizeDesc(d.descs?.[i]) === 'storm',
    heat: (d) => d && isNum(d.highs?.[i]) && d.highs[i] >= HEAT_WARM_C,
    cold: (d) => d && ((isNum(d.highs?.[i]) && d.highs[i] <= 10) || (isNum(d.lows?.[i]) && d.lows[i] <= 0)),
  };
  if (preds[key] && descEntries.length >= 3) {
    const supporting = dailies.filter(preds[key]).length;
    if (supporting < 2) { overrides.push(`${key}-consensus-failed`); reason = `${key}-consensus-failed`; key = 'clear'; }
  }
  return { key, reason, overrides, highC, lowC, rainChance, uv, conditionLabel, sourceDescs };
}

/**
 * Decide the hero for one archived hour. Mirrors api/weather.js :2200–2530 and
 * assets/app.js normalizePayload → computeHomeDisplayCondition.
 */
export function decideAt(city, i) {
  const E = ensembleAt(city, i);
  const { norms, hourlies, dailies, localHour, isDay } = E;
  const { W, HW } = adjustedWeights(norms, city.lat, city.lon);
  const normW = resolveWeights(norms, W);
  const hourlyW = resolveWeights(hourlies, HW);
  const dailyW = resolveWeights(dailies, W);
  const activeNorms = norms.filter(Boolean);

  // :2190–2262 blends
  const medNowTemp = wAvg(norms, normW, (n) => n.nowTemp);
  const medFeelsLike = wAvg(norms, normW, (n) => n.feelsLike);
  const medWindKph = wAvg(norms, normW, (n) => n.windKph);
  const medHumidity = wAvg(norms, normW, (n) => n.humidity);
  const gustArr = activeNorms.map((n) => n.gustKph).filter(isNum);
  const maxGust = gustArr.length ? Math.max(...gustArr) : null;
  const maxWindKph = Math.max(...activeNorms.map((n) => n.windKph).filter(isNum), ...gustArr, 0);
  const gustAnyArr = activeNorms.map((n) => n._gustAny).filter(isNum);
  const maxGustAny = gustAnyArr.length ? Math.max(...gustAnyArr) : null;
  const gust3Arr = activeNorms.map((n) => n._gust3).filter(isNum);
  const maxGust3 = gust3Arr.length ? Math.max(...gust3Arr) : null;

  const aggregatedHourly = aggregateHourly(hourlies, hourlyW);
  const daily0 = aggregateDaily0(dailies, dailyW, aggregatedHourly);

  // :2270–2352 selector inputs
  const currentCloudPct = aggregatedHourly[localHour]?.cloudPct ?? null;
  let currentHourRainChance = aggregatedHourly[localHour]?.rainChance ?? null;
  const nowDescEntries = norms.map((n, si) => (n && n.desc ? { desc: n.desc, weight: DESC_WEIGHTS[si] } : null)).filter(Boolean);
  const mostDesc = pickWeightedMostCommon(nowDescEntries) || 'Weather today';
  const nowHourUv = aggregatedHourly[localHour]?.uv ?? null;
  const sourceDescs = activeNorms.map((n) => n.desc).filter(Boolean);
  const sourceVotes = activeNorms.map((n) => ({ source: n.source, desc: n.desc, vote: categorizeDesc(n.desc) }));
  const precipNowArr = activeNorms.map((n) => n.precipNowMm).filter(isNum);
  // api/weather.js nowRainVotes: a current description that is rain and not a "possible".
  const rainNowVotes = sourceVotes.filter((v) => v.vote === 'rain' && !/possible/i.test(v.desc || '')).length;

  const selectorInputs = {
    desc: mostDesc,
    rainChance: currentHourRainChance,
    tempC: medNowTemp,
    feelsLikeC: medFeelsLike,
    windKph: medWindKph,
    uvIndex: isNum(nowHourUv) ? nowHourUv : null,
    cloudPct: currentCloudPct,
    maxWindKph,
    isDay,
    dailyHighC: daily0.highC,
    dailyLowC: daily0.lowC,
    sourceDescs,
    // The NOW ladder's evidence inputs, exactly as the handler passes them (:2340).
    now: true,
    precipMm: aggregatedHourly[localHour]?.precipMm ?? null,
    rainVotes: rainNowVotes,
    gustKph: maxGust,
    // Kept for the sweeps only (not read by production):
    precipNowMm: precipNowArr.length ? Math.max(...precipNowArr) : null,
  };
  let { key, reason } = deriveCondition(selectorInputs);
  const base = { key, reason };
  const overrides = [];

  // FIX-001 / FIX-002 / B-2 — the production function itself (api/weather.js applyVoteConsensus).
  {
    const c = applyVoteConsensus({ key, reason, activeNorms, sourceVotes });
    key = c.key; reason = c.reason; overrides.push(...c.overrides.map((o) => o.rule));
  }
  // :2424–2477 Tomorrow.io radar override — NOT simulated (no radar archive).
  // :2479–2500 Layer A fog detector
  const fog = detectAdvectionFog(hourlies[0], localHour, null);
  if (fog.currentFog && (key === 'clear' || key === 'partly-cloudy' || key === 'cloudy')) { overrides.push('visibility-humidity-fog-detector'); key = 'fog'; reason = 'visibility-humidity-fog-detector'; }
  // :2508–2525 Layer A.2 corroborated fog vote
  const fogVoteCount = sourceVotes.filter((v) => v.vote === 'fog' && isTrueFogDesc(v.desc)).length;
  if (corroboratedFogUpgrade({ conditionKey: key, fogVoteCount, humidity: medHumidity, windKph: medWindKph })) { overrides.push('corroborated-fog-vote'); key = 'fog'; reason = 'corroborated-fog-vote'; }

  // ---- frontend: assets/app.js normalizePayload (:2320–2380) ----
  const imminent = aggregatedHourly.slice(localHour, localHour + 4).map((x) => x.rainChance ?? 0);
  const imminentMax = imminent.length ? Math.max(...imminent) : null;
  const rainPct = isNum(imminentMax) ? imminentMax : (daily0.rainChance ?? currentHourRainChance ?? null);
  const dailyRainPct = daily0.rainChance ?? currentHourRainChance ?? null;
  const rainLater = isNum(imminentMax) && imminentMax < 30 && isNum(dailyRainPct) && dailyRainPct >= 50;
  const norm = {
    nowTemp: medNowTemp, feelsLike: medFeelsLike, todayHigh: daily0.highC, todayLow: daily0.lowC,
    // normalizePayload: the server's evidenced routes to rain (radar cannot occur in a replay).
    rainPct, dailyRainPct, rainLater, rainNowOverride: reason === 'rain-now',
    uv: isDay ? nowHourUv : null, uvMax: norms[0]?.todayUv ?? null, uvDaily: norms[0]?.todayUv ?? null,
    isDay, localHour,
    windKph: medWindKph ?? 0, maxWindKph: maxWindKph > 0 ? maxWindKph : null,
    gustKph: isNum(maxGust) && maxGust > (medWindKph ?? 0) * 1.5 ? maxGust : null,
    cloudPct: currentCloudPct,
    conditionKey: key, conditionReason: reason,
    sourceConditions: sourceVotes,
    hourly: aggregatedHourly,
    daily: [{ conditionKey: daily0.key, rainChance: daily0.rainChance }],
  };
  const display = computeHomeDisplayCondition(norm);
  const hero = computeTodaysHero(norm);

  return {
    time: E.time, localHour, isDay,
    server: { key, reason, base, overrides, votes: sourceVotes.map((v) => v.vote), rainVotes: rainNowVotes, inputs: selectorInputs },
    frontend: { display, hero, rainPct, dailyRainPct, rainLater },
    daily0,
    blends: { windKph: medWindKph, maxGust, maxGustAny, maxGust3, maxWindKph, cloudPct: currentCloudPct, rainChance: currentHourRainChance, precipMmHour: aggregatedHourly[localHour]?.precipMm ?? null, precipNowMax: selectorInputs.precipNowMm, hourCondition: aggregatedHourly[localHour]?.condition ?? null },
  };
}
