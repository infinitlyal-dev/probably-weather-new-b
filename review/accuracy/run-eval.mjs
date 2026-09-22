// ACCURACY EVAL — replay the app's condition resolver over 91 days × 6 cities and
// score it against what the airports REPORTED.
//
//   node review/accuracy/run-eval.mjs --tag before
//   node review/accuracy/run-eval.mjs --tag after
//   node review/accuracy/compare.mjs before after
//
// Ground truth = METAR present weather / wind / gust (review/accuracy/lib/obs.mjs).
// Forecast side = archived model forecasts in production's five-slot shape
// (lib/sources.mjs). Resolver = the shipped code (lib/replay.mjs).
//
// Metrics, per city and overall, for the key the PHONE shows (frontend display)
// and for the server's now.conditionKey:
//   false rain      served 'rain' with no precipitation reported that hour
//                   (strict) / in that hour or its neighbours (±1 h, tolerant)
//   missed rain     precipitation reported, served nothing wet
//                   (wet = rain, rain-possible, storm, thunder, hail)
//   missed wind     observed fresh breeze or stronger (sustained ≥ 30 km/h, or
//                   gust ≥ 45 km/h) served as a sky-only key
//                   (clear, partly-cloudy, cloudy, uv)
//   false wind      served 'wind' while the station had < 20 km/h and no gust ≥ 30
// Plus: observed wind distribution, model-vs-station wind bias, a threshold
// sweep for the wind rule, and a day-level rain calibration table.
//
// Output: review/accuracy/results/<tag>.json, <tag>.md, <tag>-hours.csv

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadStationHourly, precipNear } from './lib/obs.mjs';
import { CITIES, RANGE, ACCURACY_ROOT, loadCity } from './lib/sources.mjs';
import { decideAt } from './lib/replay.mjs';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TAG = argOf('--tag', 'run');
const ONLY = argOf('--cities', null)?.split(',');
const OBS_WINDY = { sustainedKph: 30, gustKph: 45 };   // Beaufort 5 "fresh breeze" lower bound / a gust you notice
const CALM = { sustainedKph: 20, gustKph: 30 };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const WET = new Set(['rain', 'rain-possible', 'storm', 'thunder', 'hail']);
const RAIN_STRICT = new Set(['rain', 'storm', 'thunder', 'hail']);
const SKY_ONLY = new Set(['clear', 'partly-cloudy', 'cloudy', 'uv']);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const quantile = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const outDir = path.join(ACCURACY_ROOT, 'results');
mkdirSync(outDir, { recursive: true });

const rows = [];
const perCity = {};
for (const icao of Object.keys(CITIES)) {
  if (ONLY && !ONLY.includes(icao)) continue;
  const city = loadCity(icao);
  const obs = loadStationHourly(path.join(ACCURACY_ROOT, 'obs', `metar-${icao}-${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}.csv`));
  let evaluated = 0, noObs = 0;
  for (let i = 0; i < city.nHours; i++) {
    const key = city.times[i].slice(0, 13);
    const o = obs.get(key);
    if (!o) { noObs++; continue; }
    const r = decideAt(city, i);
    evaluated++;
    const obsWindy = (isNum(o.windKph) && o.windKph >= OBS_WINDY.sustainedKph) || (isNum(o.gustKph) && o.gustKph >= OBS_WINDY.gustKph);
    const obsCalm = (!isNum(o.windKph) || o.windKph < CALM.sustainedKph) && (!isNum(o.gustKph) || o.gustKph < CALM.gustKph);
    rows.push({
      icao, time: r.time, localHour: r.localHour, isDay: r.isDay,
      display: r.frontend.display, hero: r.frontend.hero, server: r.server.key, serverReason: r.server.reason, base: r.server.base.key, overrides: r.server.overrides.join('|'),
      rainVotes: r.server.rainVotes, rainPct4h: r.frontend.rainPct, rainNow: r.blends.rainChance, dailyRainPct: r.frontend.dailyRainPct,
      fcWind: r.blends.windKph, fcGust: r.blends.maxGust, fcGustAny: r.blends.maxGustAny, fcGust3: r.blends.maxGust3, fcCloud: r.blends.cloudPct, fcPrecipMm: r.blends.precipMmHour, fcPrecipNowMax: r.blends.precipNowMax,
      dailyKey: r.daily0.key, dailyRain: r.daily0.rainChance,
      obsPrecip: o.precip || o.precipAnyReport, obsPrecipNear: precipNear(obs, key), obsThunder: o.thunder || o.thunderAnyReport, obsFog: o.fog, obsMist: o.mist,
      obsWind: o.windKph, obsGust: o.gustKph, obsCloud: o.cloudPct, obsWindy, obsCalm, wx: o.wx, metar: o.metar,
    });
  }
  perCity[icao] = { name: CITIES[icao].name, evaluated, noObs, hours: city.nHours };
  process.stderr.write(`${icao} ${CITIES[icao].name}: ${evaluated} hours scored, ${noObs} without a METAR\n`);
}

function score(list, keyField) {
  const said = (k) => list.filter((r) => r[keyField] === k);
  const saidRain = said('rain');
  const falseRainStrict = saidRain.filter((r) => !r.obsPrecip);
  const falseRainTol = saidRain.filter((r) => !r.obsPrecipNear);
  const obsPrecip = list.filter((r) => r.obsPrecip);
  const missedWet = obsPrecip.filter((r) => !WET.has(r[keyField]));
  const missedRainStrict = obsPrecip.filter((r) => !RAIN_STRICT.has(r[keyField]));
  const saidPossible = said('rain-possible');
  const possibleWet = saidPossible.filter((r) => r.obsPrecipNear);
  const windy = list.filter((r) => r.obsWindy);
  const windyServedSky = windy.filter((r) => SKY_ONLY.has(r[keyField]));
  const windyServedNotWind = windy.filter((r) => r[keyField] !== 'wind' && !RAIN_STRICT.has(r[keyField]));
  const saidWind = said('wind');
  const falseWind = saidWind.filter((r) => r.obsCalm);
  const keys = {};
  for (const r of list) keys[r[keyField]] = (keys[r[keyField]] || 0) + 1;
  return {
    hours: list.length,
    saidRain: saidRain.length,
    falseRainStrict: falseRainStrict.length, falseRainStrictPct: pct(falseRainStrict.length, saidRain.length),
    falseRainTol: falseRainTol.length, falseRainTolPct: pct(falseRainTol.length, saidRain.length),
    obsPrecipHours: obsPrecip.length,
    missedWet: missedWet.length, missedWetPct: pct(missedWet.length, obsPrecip.length),
    missedRainStrict: missedRainStrict.length, missedRainStrictPct: pct(missedRainStrict.length, obsPrecip.length),
    saidPossible: saidPossible.length, possibleWetPct: pct(possibleWet.length, saidPossible.length),
    obsWindyHours: windy.length,
    windyServedSky: windyServedSky.length, windyServedSkyPct: pct(windyServedSky.length, windy.length),
    windyServedNotWindOrRain: windyServedNotWind.length, windyServedNotWindOrRainPct: pct(windyServedNotWind.length, windy.length),
    saidWind: saidWind.length, falseWind: falseWind.length, falseWindPct: pct(falseWind.length, saidWind.length),
    keys,
  };
}

function windSweep(list) {
  // Which forecast thresholds best reproduce the station's "fresh breeze or stronger"?
  const truth = list.map((r) => r.obsWindy);
  const res = [];
  const T1s = [20, 22, 24, 25, 26, 28, 30, 32, 35, 40, Infinity];
  const T2s = [30, 35, 40, 45, 48, 50, 52, 55, 58, 60, 65, 70, Infinity];
  for (const gustField of ['fcGust', 'fcGust3', 'fcGustAny']) {
    for (const t1 of T1s) for (const t2 of T2s) {
      if (t1 === Infinity && t2 === Infinity) continue;
      let tp = 0, fp = 0, fn = 0;
      list.forEach((r, k) => {
        const pred = (isNum(r.fcWind) && r.fcWind >= t1) || (isNum(r[gustField]) && r[gustField] >= t2);
        if (pred && truth[k]) tp++; else if (pred && !truth[k]) fp++; else if (!pred && truth[k]) fn++;
      });
      const p = tp + fp ? tp / (tp + fp) : 0, rc = tp + fn ? tp / (tp + fn) : 0;
      const f1 = p + rc ? (2 * p * rc) / (p + rc) : 0;
      res.push({ gustField, meanKph: t1, gustKph: t2, tp, fp, fn, precision: Math.round(p * 1000) / 10, recall: Math.round(rc * 1000) / 10, f1: Math.round(f1 * 1000) / 10 });
    }
  }
  res.sort((a, b) => b.f1 - a.f1);
  return res;
}

function windBias(list) {
  const ratios = list.filter((r) => isNum(r.obsWind) && isNum(r.fcWind) && r.fcWind > 0 && r.obsWind > 0).map((r) => r.obsWind / r.fcWind);
  const gustRatios = list.filter((r) => isNum(r.obsGust) && isNum(r.fcGust) && r.fcGust > 0).map((r) => r.obsGust / r.fcGust);
  const obsW = list.map((r) => r.obsWind).filter(isNum);
  const obsG = list.map((r) => r.obsGust).filter(isNum);
  return {
    medianObsOverForecastMean: Math.round(quantile(ratios, 0.5) * 100) / 100,
    medianObsGustOverForecastGust: gustRatios.length ? Math.round(quantile(gustRatios, 0.5) * 100) / 100 : null,
    obsSustainedP50: quantile(obsW, 0.5), obsSustainedP90: quantile(obsW, 0.9), obsSustainedP95: quantile(obsW, 0.95),
    hoursWithGustGroup: obsG.length, obsGustP50: quantile(obsG, 0.5), obsGustP90: quantile(obsG, 0.9),
    hoursBeaufort5plus: list.filter((r) => isNum(r.obsWind) && r.obsWind >= 29).length,
    hoursSustained30: list.filter((r) => isNum(r.obsWind) && r.obsWind >= 30).length,
    hoursGust45: list.filter((r) => isNum(r.obsGust) && r.obsGust >= 45).length,
  };
}

function dailyCalibration(list) {
  // Day-level: did it rain at all that day (any METAR hour), against the blended daily % and key at 06:00.
  const days = new Map();
  for (const r of list) {
    const d = r.time.slice(0, 10);
    const rec = days.get(`${r.icao}|${d}`) || { icao: r.icao, date: d, rained: false, dailyRain: null, dailyKey: null };
    if (r.obsPrecip) rec.rained = true;
    if (r.localHour === 6) { rec.dailyRain = r.dailyRain; rec.dailyKey = r.dailyKey; }
    days.set(`${r.icao}|${d}`, rec);
  }
  const all = [...days.values()].filter((d) => isNum(d.dailyRain));
  const bins = [[0, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 80], [80, 101]];
  const table = bins.map(([lo, hi]) => {
    const inBin = all.filter((d) => d.dailyRain >= lo && d.dailyRain < hi);
    return { bin: `${lo}–${hi - (hi === 101 ? 1 : 0)}%`, days: inBin.length, rainedPct: pct(inBin.filter((d) => d.rained).length, inBin.length) };
  });
  const keyRows = {};
  for (const d of all) {
    const k = keyRows[d.dailyKey] || { days: 0, rained: 0 };
    k.days++; if (d.rained) k.rained++;
    keyRows[d.dailyKey] = k;
  }
  for (const k of Object.keys(keyRows)) keyRows[k].rainedPct = pct(keyRows[k].rained, keyRows[k].days);
  return { days: all.length, byBin: table, byKey: keyRows };
}

const result = { tag: TAG, generatedAt: new Date().toISOString(), range: RANGE, obsWindy: OBS_WINDY, calm: CALM, coverage: perCity, cities: {}, all: {} };
for (const icao of Object.keys(perCity)) {
  const list = rows.filter((r) => r.icao === icao);
  result.cities[icao] = { name: CITIES[icao].name, display: score(list, 'display'), server: score(list, 'server'), windBias: windBias(list) };
}
result.all = { display: score(rows, 'display'), server: score(rows, 'server'), windBias: windBias(rows), windSweepTop: windSweep(rows).slice(0, 12), dailyCalibration: dailyCalibration(rows) };
// The current rule, for reference: mean ≥ 30 (strong) / ≥ 25 (moderate), gusts unread.
result.all.windSweepCurrentRule = windSweep(rows).filter((s) => s.gustField === 'fcGust' && s.gustKph === Infinity && (s.meanKph === 25 || s.meanKph === 30));

writeFileSync(path.join(outDir, `${TAG}.json`), JSON.stringify(result, null, 1));
const cols = Object.keys(rows[0]);
writeFileSync(path.join(outDir, `${TAG}-hours.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => { const v = r[c]; return typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : (v ?? ''); }).join(','))].join('\n'));

// Markdown
const md = [];
md.push(`# Accuracy eval — ${TAG}`, '', `Generated ${result.generatedAt}. ${RANGE.from} → ${RANGE.to}, six SA airports, METAR ground truth. Observed "windy" = sustained ≥ ${OBS_WINDY.sustainedKph} km/h or gust ≥ ${OBS_WINDY.gustKph} km/h.`, '');
const line = (name, s) => `| ${name} | ${s.hours} | ${s.saidRain} | ${s.falseRainStrict} (${s.falseRainStrictPct}%) | ${s.falseRainTol} (${s.falseRainTolPct}%) | ${s.obsPrecipHours} | ${s.missedWet} (${s.missedWetPct}%) | ${s.missedRainStrict} (${s.missedRainStrictPct}%) | ${s.obsWindyHours} | ${s.windyServedSky} (${s.windyServedSkyPct}%) | ${s.saidWind} | ${s.falseWind} (${s.falseWindPct}%) |`;
for (const layer of ['display', 'server']) {
  md.push(`## ${layer === 'display' ? 'What the phone shows (frontend display key)' : 'Server now.conditionKey'}`, '');
  md.push('| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |');
  md.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const icao of Object.keys(result.cities)) md.push(line(result.cities[icao].name, result.cities[icao][layer]));
  md.push(line('**All six**', result.all[layer]), '');
  md.push(`Keys served (all six): ${Object.entries(result.all[layer].keys).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '');
}
md.push('## Observed wind and model bias', '', '| city | obs sustained p50 / p90 / p95 km/h | hours ≥ 30 sustained | hours gust ≥ 45 | median obs ÷ forecast mean | median obs gust ÷ forecast gust |', '|---|---|---|---|---|---|');
for (const icao of Object.keys(result.cities)) { const b = result.cities[icao].windBias; md.push(`| ${result.cities[icao].name} | ${b.obsSustainedP50} / ${b.obsSustainedP90} / ${b.obsSustainedP95} | ${b.hoursSustained30} | ${b.hoursGust45} | ${b.medianObsOverForecastMean} | ${b.medianObsGustOverForecastGust} |`); }
md.push('', '## Wind rule sweep (all six; predicting observed windy from blended mean ≥ T1 or max gust ≥ T2)', '', '| gust source | mean ≥ | gust ≥ | precision | recall | F1 | hit | false alarm | miss |', '|---|---|---|---|---|---|---|---|---|');
for (const s of result.all.windSweepTop) md.push(`| ${s.gustField === 'fcGust' ? 'OM+Pirate gust' : s.gustField === 'fcGust3' ? 'OM+WA+Pirate gust' : 'any source gust'} | ${s.meanKph} | ${s.gustKph} | ${s.precision}% | ${s.recall}% | ${s.f1} | ${s.tp} | ${s.fp} | ${s.fn} |`);
for (const s of result.all.windSweepCurrentRule) md.push(`| current rule (mean only) | ${s.meanKph} | — | ${s.precision}% | ${s.recall}% | ${s.f1} | ${s.tp} | ${s.fp} | ${s.fn} |`);
const dc = result.all.dailyCalibration;
md.push('', `## Daily rain % calibration (${dc.days} station-days; blended daily % read at 06:00 vs. any rain reported that day)`, '', '| blended daily % | days | days it actually rained |', '|---|---|---|');
for (const b of dc.byBin) md.push(`| ${b.bin} | ${b.days} | ${b.rainedPct}% |`);
md.push('', '| daily key at 06:00 | days | days it actually rained |', '|---|---|---|');
for (const [k, v] of Object.entries(dc.byKey)) md.push(`| ${k} | ${v.days} | ${v.rainedPct}% |`);
writeFileSync(path.join(outDir, `${TAG}.md`), md.join('\n') + '\n');
process.stderr.write(`wrote results/${TAG}.json, .md, -hours.csv (${rows.length} hours)\n`);
