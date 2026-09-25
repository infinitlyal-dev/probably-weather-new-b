// "RAIN'S HERE" — the hero's rain call, replayed on real past forecasts, per region.
//   node review/accuracy/v2/rainhere.mjs
// The rule as ruled (review/CONDITION-LOGIC.md, api/weather.js): rain now = at least 2 sources describe
// rain for the hour AND the blended chance ≥ 60 % AND the blended amount ≥ 0.3 mm (the radar override is
// Tomorrow.io's and has no archive). Replayed with the three archived models that carry an hourly % and
// weather code (best_match = production's Open-Meteo, ECMWF 0.25°, GFS), short-lead archive + latest-run
// amounts. Truth: METAR precipitation in that hour; "dry ±1 h" = none in the hour or either neighbour.
// Report only: the rule is Al's ruling and is not changed here.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SCORED, HIST_MODELS, PERIOD } from './stations.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, TEST, inRange, isNum, mean, round, RESULTS } from './lib.mjs';
import { RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM } from '../../../api/weather.js';

const NO_WX = new Set(['FALW', 'FAHS', 'FAWB', 'FAEL']);
const RAIN_CODES = (c) => isNum(c) && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95);
const out = { rule: { minProb: RAIN_NOW_MIN_PROB, minMm: RAIN_NOW_MIN_MM }, test: TEST, byStation: {}, byRegion: {}, all: null };
const tally = () => ({ calls: 0, dryHour: 0, dryNear: 0, rainHours: 0, caught: 0 });
const add = (a, b) => { for (const k of Object.keys(a)) a[k] += b[k]; };
for (const st of SCORED.filter((s) => !NO_WX.has(s.id))) {
  const obs = loadObs(st.id);
  const hist = Object.fromEntries(HIST_MODELS.map((m) => [m, loadHist(st.id, m)]));
  const runs = Object.fromEntries(HIST_MODELS.map((m) => [m, loadRuns(st.id, m)]));
  if (HIST_MODELS.some((m) => !hist[m] || !runs[m])) { console.error(`${st.id}: data missing`); continue; }
  const t = tally();
  for (const d of days(TEST.from, TEST.to)) {
    for (let h = 1; h < 23; h++) {
      const o = obs.get(hourKey(d, h)); if (!o) continue;
      const prev = obs.get(hourKey(d, h - 1)), next = obs.get(hourKey(d, h + 1));
      const wet = Boolean(o.precip || o.precipAnyReport);
      const wetNear = wet || Boolean(prev?.precip || prev?.precipAnyReport || next?.precip || next?.precipAnyReport);
      const k = hourKey(d, h);
      const votes = HIST_MODELS.filter((m) => RAIN_CODES(hist[m].get(k)?.code)).length;
      const prob = mean(HIST_MODELS.map((m) => hist[m].get(k)?.pp));
      const mm = mean(HIST_MODELS.map((m) => runs[m].get(k)?.p0));
      const call = votes >= 2 && isNum(prob) && prob >= RAIN_NOW_MIN_PROB && isNum(mm) && mm >= RAIN_NOW_MIN_MM;
      if (wet) { t.rainHours++; if (call) t.caught++; }
      if (call) { t.calls++; if (!wet) t.dryHour++; if (!wetNear) t.dryNear++; }
    }
  }
  out.byStation[st.id] = { region: st.region, ...t };
  (out.byRegion[st.region] ||= tally()); add(out.byRegion[st.region], t);
}
out.all = tally(); for (const t of Object.values(out.byRegion)) add(out.all, t);
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'rainhere.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
console.log(`"Rain's here" replayed on TEST (${TEST.from} → ${TEST.to}), rule ≥2 votes, ≥${RAIN_NOW_MIN_PROB}%, ≥${RAIN_NOW_MIN_MM} mm`);
for (const [g, t] of Object.entries({ ...out.byRegion, 'ALL': out.all })) console.log(`${g.padEnd(14)} calls ${t.calls}: dry that hour ${t.dryHour} (${pct(t.dryHour, t.calls)}), dry ±1 h ${t.dryNear} (${pct(t.dryNear, t.calls)}) | rain hours ${t.rainHours}, called ${t.caught} (${pct(t.caught, t.rainHours)})`);
