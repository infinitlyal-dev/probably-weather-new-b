// WIND, GUSTS AND FOG — how close is each model, and does a per-station correction help?
//   node review/accuracy/v2/wind.mjs
// Truth: METAR 10-minute mean wind, the gust group, and FG (fog) at the scored airports.
// Wind: real past forecasts (latest run t0) of six models, hourly. Gusts and visibility: the short-lead
// archive (best_match = production's Open-Meteo, ECMWF 0.25°, GFS). Corrections learned on TRAIN (2025):
// mean wind — a per-station × season × day-part ratio; gusts — a per-station ratio. Numbers on TEST (2026).
import { mkdirSync, writeFileSync } from 'node:fs';
// 7-day bootstrap blocks (weather regimes last several days), as in temps.mjs.
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
import path from 'node:path';
import { SCORED, RUN_MODELS, HIST_MODELS, PERIOD } from './stations.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, RESULTS } from './lib.mjs';
import { detectAdvectionFog } from '../../../api/weather.js';
// relative humidity from temperature and dew point (Magnus), as Open-Meteo's own relative_humidity_2m
const rhOf = (t, d) => (isNum(t) && isNum(d) ? 100 * Math.exp((17.625 * d) / (243.04 + d)) / Math.exp((17.625 * t) / (243.04 + t)) : null);

const PART = (h) => (h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
const WINDY = 30;             // km/h mean: "a fresh breeze" (Beaufort 5), as in the first harness
const GUSTY = 55;             // production's gust line for the wind condition
const NO_WX = new Set(['FALW', 'FAHS', 'FAWB']);

const rows = [];
for (const st of SCORED) {
  const obs = loadObs(st.id);
  const runs = Object.fromEntries(RUN_MODELS.map((m) => [m, loadRuns(st.id, m)]).filter(([, v]) => v));
  const hist = Object.fromEntries(HIST_MODELS.map((m) => [m, loadHist(st.id, m)]).filter(([, v]) => v));
  if (Object.keys(runs).length < RUN_MODELS.length || Object.keys(hist).length < HIST_MODELS.length) { console.error(`${st.id}: data missing`); continue; }
  for (const d of days(PERIOD.from, PERIOD.to)) {
    for (let h = 0; h < 24; h++) {
      const o = obs.get(hourKey(d, h));
      if (!o || !isNum(o.windKph)) continue;
      const k = hourKey(d, h);
      rows.push({ id: st.id, region: st.region, day: d, h, season: SEASON(d), part: PART(h),
        obsWind: o.windKph, obsGust: o.gustKph, obsFog: NO_WX.has(st.id) ? null : Boolean(o.fog), obsVis: o.visKm,
        wind: Object.fromEntries(RUN_MODELS.map((m) => [m, runs[m].get(k)?.w0])),
        gust: Object.fromEntries(HIST_MODELS.map((m) => [m, hist[m].get(k)?.gust])),
        vis: Object.fromEntries(HIST_MODELS.map((m) => [m, hist[m].get(k)?.vis])),
        spread: (() => { const r = runs.best_match.get(k); return r && isNum(r.t0) && isNum(r.dew) ? r.t0 - r.dew : null; })(),
        // what production's Open-Meteo fog detector reads for this hour (Tomorrow.io's visibility has no archive)
        om: (() => { const r = runs.best_match.get(k), hh = hist.best_match.get(k); return { vis: hh?.vis, pp: hh?.pp, t: r?.t0, dew: r?.dew, mm: r?.p0, rh: rhOf(r?.t0, r?.dew) }; })(),
      });
    }
  }
}
const train = rows.filter((r) => inRange(r.day, TRAIN));
const test = rows.filter((r) => inRange(r.day, TEST));

// ---- mean wind ----
const ratio = {};   // ratio[model][station|season|part] = mean(obs) / mean(fc) on TRAIN
for (const m of RUN_MODELS) {
  ratio[m] = {};
  const g = new Map();
  for (const r of train) { if (!isNum(r.wind[m])) continue; const key = `${r.id}|${r.season}|${r.part}`; const a = g.get(key) || { o: 0, f: 0, n: 0 }; a.o += r.obsWind; a.f += r.wind[m]; a.n++; g.set(key, a); }
  for (const [key, a] of g) ratio[m][key] = a.n >= 40 && a.f > 0 ? Math.min(2.5, Math.max(0.4, a.o / a.f)) : 1;
}
const corrected = (r, m) => (isNum(r.wind[m]) ? r.wind[m] * (ratio[m][`${r.id}|${r.season}|${r.part}`] ?? 1) : null);
const windMethods = {
  ...Object.fromEntries(RUN_MODELS.map((m) => [`model: ${m}`, (r) => r.wind[m]])),
  'mean of 6 models': (r) => mean(RUN_MODELS.map((m) => r.wind[m])),
  'mean of 6, each corrected': (r) => mean(RUN_MODELS.map((m) => corrected(r, m))),
  'best_match, corrected': (r) => corrected(r, 'best_match'),
};
const windScore = (list, f) => {
  const e = list.map((r) => { const x = f(r); return isNum(x) ? { err: x - r.obsWind, windy: r.obsWind >= WINDY, said: x >= 25 } : null; }).filter(Boolean);
  const windy = e.filter((x) => x.windy);
  return { n: e.length, mae: mean(e.map((x) => Math.abs(x.err))), bias: mean(e.map((x) => x.err)), windyHours: windy.length, windyCaught: windy.filter((x) => x.said).length, falseWind: e.filter((x) => !x.windy && x.said).length };
};

// ---- gusts (hours whose METAR carries a gust group) ----
const gustRatio = {};
for (const m of HIST_MODELS) {
  gustRatio[m] = {};
  for (const st of SCORED) {
    const t = train.filter((r) => r.id === st.id && isNum(r.obsGust) && isNum(r.gust[m]));
    gustRatio[m][st.id] = t.length >= 30 ? Math.min(2, Math.max(0.5, mean(t.map((r) => r.obsGust)) / mean(t.map((r) => r.gust[m])))) : 1;
  }
}
const gustMethods = {
  ...Object.fromEntries(HIST_MODELS.map((m) => [`model: ${m}`, (r) => r.gust[m]])),
  'largest of the three (production takes the largest source gust)': (r) => Math.max(...HIST_MODELS.map((m) => r.gust[m]).filter(isNum)),
  'best_match, corrected': (r) => (isNum(r.gust.best_match) ? r.gust.best_match * gustRatio.best_match[r.id] : null),
};
const gustScore = (list, f) => {
  const e = list.filter((r) => isNum(r.obsGust)).map((r) => { const x = f(r); return isNum(x) ? { err: x - r.obsGust, big: r.obsGust >= GUSTY, said: x >= GUSTY } : null; }).filter(Boolean);
  const big = e.filter((x) => x.big);
  return { n: e.length, mae: mean(e.map((x) => Math.abs(x.err))), bias: mean(e.map((x) => x.err)), bigGusts: big.length, bigCaught: big.filter((x) => x.said).length, falseBig: e.filter((x) => !x.big && x.said).length };
};

// ---- fog (FG reported) ----
// production's detector, replayed hour by hour on Open-Meteo's archived reads (OM-only, as when Tomorrow.io has no visibility)
const detector = (r) => detectAdvectionFog({ visibility: [r.om.vis], humidity: [r.om.rh], temps: [r.om.t], dewPoints: [r.om.dew], rains: [r.om.pp], precipMm: [r.om.mm] }, 0).currentFog;
// the same shape with stricter gates, the gates chosen on TRAIN by the best critical success index
const gated = (g) => (r) => isNum(r.om.vis) && r.om.vis < g.vis && isNum(r.om.rh) && r.om.rh >= g.rh && isNum(r.om.t) && isNum(r.om.dew) && r.om.t - r.om.dew <= g.spread && (!isNum(r.om.pp) || r.om.pp < 30) && (!isNum(r.om.mm) || r.om.mm < 0.2);
const fogCsi = (list, fn) => { const t = list.filter((r) => r.obsFog !== null); const h = t.filter((r) => r.obsFog && fn(r)).length, m = t.filter((r) => r.obsFog && !fn(r)).length, fa = t.filter((r) => !r.obsFog && fn(r)).length; return h + m + fa ? h / (h + m + fa) : 0; };
let bestGate = null;
for (const vis of [1500, 1000, 700, 500, 300]) for (const rh of [90, 93, 95, 97]) for (const spread of [2, 1.5, 1, 0.5]) { const c = fogCsi(train, gated({ vis, rh, spread })); if (!bestGate || c > bestGate.csi) bestGate = { vis, rh, spread, csi: c }; }
const fogMethods = {
  "the app's fog detector (replayed)": detector,
  [`stricter gates (2025's best: visibility < ${bestGate.vis} m, humidity ≥ ${bestGate.rh} %, spread ≤ ${bestGate.spread} °C)`]: gated(bestGate),
  'best_match visibility < 1 km': (r) => isNum(r.vis.best_match) && r.vis.best_match < 1000,
  'GFS visibility < 1 km': (r) => isNum(r.vis.gfs_seamless) && r.vis.gfs_seamless < 1000,
  'ECMWF 0.25° visibility < 1 km': (r) => isNum(r.vis.ecmwf_ifs025) && r.vis.ecmwf_ifs025 < 1000,
  'any of the three < 1 km': (r) => HIST_MODELS.some((m) => isNum(r.vis[m]) && r.vis[m] < 1000),
  'two of three < 1 km': (r) => HIST_MODELS.filter((m) => isNum(r.vis[m]) && r.vis[m] < 1000).length >= 2,
  'best_match dew-point spread < 1 °C, night': (r) => isNum(r.spread) && r.spread < 1 && (r.h < 9 || r.h >= 20),
};
const fogScore = (list, f) => {
  const t = list.filter((r) => r.obsFog !== null);
  const hits = t.filter((r) => r.obsFog && f(r)).length, misses = t.filter((r) => r.obsFog && !f(r)).length, fa = t.filter((r) => !r.obsFog && f(r)).length;
  return { fogHours: hits + misses, hits, misses, falseAlarms: fa, csi: hits + misses + fa ? hits / (hits + misses + fa) : null };
};

const regions = [...new Set(SCORED.map((s) => s.region))];
const out = { test: TEST, train: TRAIN, wind: {}, windByRegion: {}, gust: {}, gustByStation: {}, fog: {}, fogByStation: {}, boot: {} };
out.wind = Object.fromEntries(Object.entries(windMethods).map(([n, f]) => [n, windScore(test, f)]));
out.windByRegion = Object.fromEntries(regions.map((g) => [g, Object.fromEntries(Object.entries(windMethods).map(([n, f]) => [n, windScore(test.filter((r) => r.region === g), f)]))]));
out.gust = Object.fromEntries(Object.entries(gustMethods).map(([n, f]) => [n, gustScore(test, f)]));
out.gustByStation = Object.fromEntries(SCORED.map((s) => [s.id, Object.fromEntries(Object.entries(gustMethods).map(([n, f]) => [n, gustScore(test.filter((r) => r.id === s.id), f)]))]));
out.fog = Object.fromEntries(Object.entries(fogMethods).map(([n, f]) => [n, fogScore(test, f)]));
out.fogByStation = Object.fromEntries(SCORED.map((s) => [s.id, Object.fromEntries(Object.entries(fogMethods).map(([n, f]) => [n, fogScore(test.filter((r) => r.id === s.id), f)]))]));
const bestWindModel = RUN_MODELS.map((m) => [m, out.wind[`model: ${m}`].mae]).sort((a, b) => a[1] - b[1])[0][0];
out.boot.wind = { bestWindModel,
  'mean of 6, each corrected vs best model': bootDiff(test.map((r) => ({ day: r.day, a: Math.abs(windMethods['mean of 6, each corrected'](r) - r.obsWind), b: Math.abs(r.wind[bestWindModel] - r.obsWind) })), 1000, 7, week),
  'mean of 6, each corrected vs best_match (production OM)': bootDiff(test.map((r) => ({ day: r.day, a: Math.abs(windMethods['mean of 6, each corrected'](r) - r.obsWind), b: Math.abs(r.wind.best_match - r.obsWind) })), 1000, 7, week),
};
out.boot.gust = { 'best_match corrected vs largest of three': bootDiff(test.filter((r) => isNum(r.obsGust)).map((r) => ({ day: r.day, a: Math.abs(gustMethods['best_match, corrected'](r) - r.obsGust), b: Math.abs(gustMethods['largest of the three (production takes the largest source gust)'](r) - r.obsGust) })), 1000, 7, week) };
out.fit = { windRatio: ratio, gustRatio, fogGate: bestGate };
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'wind.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));

console.log(`== MEAN WIND (hourly, TEST) — windy = station ≥ ${WINDY} km/h; "said wind" = forecast ≥ 25`);
for (const [n, s] of Object.entries(out.wind)) console.log(`${n.padEnd(34)} MAE ${s.mae.toFixed(2)} bias ${s.bias.toFixed(2)} | windy hours caught ${s.windyCaught}/${s.windyHours} · false ${s.falseWind}`);
for (const [n, b] of Object.entries(out.boot.wind)) if (b?.diff !== undefined) console.log(`  ${n}: ${b.diff.toFixed(2)} [${b.lo.toFixed(2)}, ${b.hi.toFixed(2)}]`);
console.log(`\n== GUSTS (hours with a METAR gust group) — big = ≥ ${GUSTY} km/h`);
for (const [n, s] of Object.entries(out.gust)) console.log(`${n.padEnd(64)} MAE ${s.mae?.toFixed(2)} bias ${s.bias?.toFixed(2)} | big caught ${s.bigCaught}/${s.bigGusts} · false ${s.falseBig} (n${s.n})`);
const bg = out.boot.gust['best_match corrected vs largest of three']; if (bg) console.log(`  best_match corrected vs largest: ${bg.diff.toFixed(2)} [${bg.lo.toFixed(2)}, ${bg.hi.toFixed(2)}]`);
console.log('\n== FOG (FG reported), TEST');
for (const [n, s] of Object.entries(out.fog)) console.log(`${n.padEnd(42)} fog hours ${s.fogHours}: hit ${s.hits} miss ${s.misses} false ${s.falseAlarms} CSI ${s.csi?.toFixed(3)}`);
