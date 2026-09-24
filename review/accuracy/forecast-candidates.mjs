// FORECAST CANDIDATES (launch run, 2026-09-25) — the two blend findings of the launch eval, and
// the candidate fixes for each, scored on the same days and the same truth as blend-vs-sources.mjs.
//
//   node review/accuracy/forecast-candidates.mjs [--boot 2000]
//
// (1) The day's LOW. Production blends it with LOW_WEIGHTS = [OM .30, WA .22 (halved by the ECMWF
//     dedup), PW .13, MET 0, TI 0] (api/weather.js:1974). Candidates: drop Pirate (the GFS-family
//     source whose stand-in reads nights +3 °C warm), Open-Meteo alone.
// (2) The day's HIGH read later in the day. MET's strict window drops out at noon and Tomorrow.io's
//     "today" is now → midnight, so by evening its "high" is the evening's temperature. Candidate:
//     from local noon, a source whose today-window no longer holds the afternoon (MET, TI) does not
//     vote on today's high — the high blends the sources that forecast the whole day (OM, WA, PW).
// Scored per airport and pooled; "clearly better" = the day-block bootstrap 95% interval of
// (candidate − current) MAE lies wholly below zero. The blend's weighting is copied from
// blend-vs-sources.mjs (which cites api/weather.js line by line); the windows are fedDay0's.
// Output: results/forecast-candidates.md / .json.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadStationHourly } from './lib/obs.mjs';
import { CITIES, RANGE, ACCURACY_ROOT, loadCity, metHourlyRainProxy, metDailyRainProxy } from './lib/sources.mjs';

const args = process.argv.slice(2);
const BOOT = Number(args[args.indexOf('--boot') + 1] || 2000) || 2000;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const maxOf = (a) => { const v = (a || []).filter(isNum); return v.length ? Math.max(...v) : null; };
const minOf = (a) => { const v = (a || []).filter(isNum); return v.length ? Math.min(...v) : null; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const rnd = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ---- production weighting (copied from blend-vs-sources.mjs, which cites api/weather.js) ----
const BASE_WEIGHTS = [0.30, 0.22, 0.13, 0.20, 0.15];
function productionWeights(highs, lat, lon) {
  const W = [...BASE_WEIGHTS]; let waDedupFactor = 1;
  if (isNum(highs[0]) && isNum(highs[1]) && Math.abs(highs[0] - highs[1]) <= 0.5) { W[1] = W[1] / 2; waDedupFactor = 0.5; }
  const isHighveld = lat > -28 && lon > 25;
  if (isNum(highs[3]) && !isHighveld) {
    const fam = [highs[0], highs[1]].filter(isNum);
    if (fam.length && highs[3] - fam.reduce((a, b) => a + b, 0) / fam.length > 5) { W[0] = 0.25; W[3] = 0.40; }
  }
  return { W, LOW: [BASE_WEIGHTS[0], BASE_WEIGHTS[1] * waDedupFactor, BASE_WEIGHTS[2], 0, 0], waDedupFactor };
}
function resolveWeights(arr, base) {
  const active = arr.map((item, i) => (item !== null ? (base[i] ?? 0) : 0));
  const total = active.reduce((s, v) => s + v, 0);
  if (total === 0) { const n = arr.filter(Boolean).length; return arr.map((item) => (item !== null && n ? 1 / n : 0)); }
  return active.map((v) => v / total);
}
function wAvg(arr, weights, get) {
  let s = 0, w = 0;
  arr.forEach((item, i) => { if (item === null) return; const v = get(item); if (isNum(v)) { s += v * weights[i]; w += weights[i]; } });
  return w > 0 ? Math.round((s / w) * 10) / 10 : null;
}
const blend5 = (values, weights) => { const recs = values.map((v) => ({ v })); return wAvg(recs, resolveWeights(recs, weights), (r) => r.v); };

// What each slot feeds day 0 when the app is opened at local hour H (blend-vs-sources.mjs fedDay0).
function fedDay0(S, city, d, H) {
  const seg = (arr, a, b) => (arr || []).slice(d * 24 + a, d * 24 + b);
  const metStrict = 24 - H >= 12;
  return {
    highs: [city.D.bm.tmax[d], maxOf(seg(S[1].temp, 0, 24)), maxOf(seg(S[2].temp, 7, 19)), metStrict ? maxOf(seg(S[3].temp, H, 24)) : null, maxOf(seg(S[4].temp, H, 24))],
    lows: [city.D.bm.tmin[d], minOf(seg(S[1].temp, 0, 24)), minOf(seg(S[2].temp, 0, 24)), metStrict ? minOf(seg(S[3].temp, H, 24)) : null, minOf(seg(S[4].temp, H, 24))],
  };
}

// ---- candidates ----
const LOW_CANDIDATES = {
  current: (w) => w.LOW,
  noPirate: (w) => [BASE_WEIGHTS[0], BASE_WEIGHTS[1] * w.waDedupFactor, 0, 0, 0],
  omOnly: () => [1, 0, 0, 0, 0],
  pirateHalf: (w) => [BASE_WEIGHTS[0], BASE_WEIGHTS[1] * w.waDedupFactor, BASE_WEIGHTS[2] / 2, 0, 0],
};
const median3 = (a) => { const v = a.filter(isNum).sort((x, y) => x - y); return v.length === 3 ? v[1] : v.length ? Math.round((v.reduce((p, c) => p + c, 0) / v.length) * 10) / 10 : null; };
// From local noon the sources whose today-window has lost the afternoon (MET null already; TI now→midnight) stop voting.
const highFullDayOnly = (fed, H) => (H >= 12 ? [fed.highs[0], fed.highs[1], fed.highs[2], null, null] : fed.highs);

// ---- build rows ----
const TEMP_RULE = { minHours: 18, minWindow: [4, 8], maxWindow: [12, 16] };
const SLOT_KEYS = ['bm', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'];
const tag = `${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}`;
const READ_HOURS = [6, 12, 15, 18, 21];
const rows = [];
const hourRows = [];
for (const icao of Object.keys(CITIES)) {
  const city = loadCity(icao);
  const obs = loadStationHourly(path.join(ACCURACY_ROOT, 'obs', `metar-${icao}-${tag}.csv`));
  const S = SLOT_KEYS.map((k) => city.H[k]);
  for (let d = 0; d < city.nDays; d++) {
    const date = city.D.dates[d];
    const temps = [];
    for (let h = 0; h < 24; h++) { const o = obs.get(`${date}T${String(h).padStart(2, '0')}`); if (o && isNum(o.tempC)) temps.push({ h, t: o.tempC }); }
    const inWin = ([a, b]) => temps.some((x) => x.h >= a && x.h <= b);
    if (!(temps.length >= TEMP_RULE.minHours && inWin(TEMP_RULE.minWindow) && inWin(TEMP_RULE.maxWindow))) continue;
    const row = { icao, date, obsMax: Math.max(...temps.map((x) => x.t)), obsMin: Math.min(...temps.map((x) => x.t)), low: {}, high: {} };
    const am = fedDay0(S, city, d, 6);
    const w6 = productionWeights(am.highs, city.lat, city.lon);
    for (const [k, f] of Object.entries(LOW_CANDIDATES)) row.low[k] = blend5(am.lows, f(w6));
    row.low.PW = am.lows[2];
    row.high.noTI6 = blend5([am.highs[0], am.highs[1], am.highs[2], am.highs[3], null], w6.W);
    row.high.cur6 = blend5(am.highs, w6.W);
    { const seg = (arr, a, b) => (arr || []).slice(d * 24 + a, d * 24 + b); const rains = [city.D.bm.ppmax[d], maxOf(seg(S[1].pp, 0, 24)), maxOf(seg(S[2].pp, 0, 24)), metDailyRainProxy(maxOf(seg(S[3].mm, 6, 24))), maxOf(seg(S[4].pp, 6, 24))]; row.rainCur = blend5(rains, w6.W); row.rainNoTI = blend5([...rains.slice(0, 4), null], w6.W); let rained = false; for (let h = 0; h < 24; h++) { const o = obs.get(date + 'T' + String(h).padStart(2, '0')); if (o && (o.precip || o.precipAnyReport)) rained = true; } row.obsRain = rained; }
    row.low.median3 = median3(am.lows.slice(0, 3));
    for (let H = 12; H <= 23; H++) { const fed = fedDay0(S, city, d, H); const w = productionWeights(fed.highs, city.lat, city.lon); row.high['cur@' + H] = blend5(fed.highs, w.W); for (const CUT of [13, 14, 15, 16, 17, 18, 19]) row.high['cut' + CUT + '@' + H] = blend5(H >= CUT ? [fed.highs[0], fed.highs[1], fed.highs[2], null, null] : fed.highs, w.W); }
    for (const H of READ_HOURS) {
      const fed = fedDay0(S, city, d, H);
      const w = productionWeights(fed.highs, city.lat, city.lon);
      row.high[`current@${H}`] = blend5(fed.highs, w.W);
      row.high[`fullDayOnly@${H}`] = blend5(highFullDayOnly(fed, H), w.W);
    }
    rows.push(row);
  }
  // hours: blended rain % with and without Tomorrow.io (hourly slots OM, WA, MET, TI; production HW)
  // An hour whose every report has "//" in the present-weather slot observed nothing (blend-vs-sources.mjs wxObserved).
  const wxUnobservedText = (metar) => /(^|\s)\/\/(\s|$)/.test(String(metar || '').split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0]);
  for (let i = 0; i < city.nHours; i++) { const o = obs.get(city.times[i].slice(0, 13)); if (!o) continue; const unobs = (o.all || []).length && o.all.every((r) => wxUnobservedText(r.metar)); const precip = !!(o.precip || o.precipAnyReport); if (!precip && unobs) continue; const d = Math.floor(i / 24), h = i % 24; const fed = fedDay0(S, city, d, h); const w = productionWeights(fed.highs, city.lat, city.lon); const hb = [w.W[0], w.W[1], w.W[3], w.W[4]]; const at = (a) => (a && isNum(a[i]) ? a[i] : null); const p = [at(S[0].pp), at(S[1].pp), metHourlyRainProxy(at(S[3].mm)), at(S[4].pp)]; hourRows.push({ icao, date: city.D.dates[d], y: precip, cur: blend5(p, hb), noTI: blend5([p[0], p[1], p[2], null], hb) }); }
}

// ---- scoring with a day-block bootstrap of (candidate − current) ----
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function compare(sample, getCur, getCand, truth, seed) {
  const ok = sample.filter((r) => isNum(getCur(r)) && isNum(getCand(r)));
  const eCur = ok.map((r) => getCur(r) - truth(r)), eCand = ok.map((r) => getCand(r) - truth(r));
  const diffs = ok.map((_, i) => Math.abs(eCand[i]) - Math.abs(eCur[i]));
  const rng = mulberry32(seed); const draws = [];
  for (let t = 0; t < BOOT; t++) { let s = 0; for (let j = 0; j < diffs.length; j++) s += diffs[Math.floor(rng() * diffs.length)]; draws.push(s / diffs.length); }
  draws.sort((a, b) => a - b);
  const within1 = (e) => rnd((e.filter((x) => Math.abs(x) <= 1).length / e.length) * 100, 0);
  return {
    n: ok.length, current: { mae: rnd(mean(eCur.map(Math.abs))), bias: rnd(mean(eCur), 1), within1C: within1(eCur) },
    candidate: { mae: rnd(mean(eCand.map(Math.abs))), bias: rnd(mean(eCand), 1), within1C: within1(eCand) },
    diff: rnd(mean(diffs), 3), ci: [rnd(draws[Math.floor(0.025 * BOOT)], 3), rnd(draws[Math.floor(0.975 * BOOT)], 3)],
  };
}
const groups = [...Object.keys(CITIES).map((k) => ({ key: k, name: CITIES[k].name, rows: rows.filter((r) => r.icao === k) })), { key: 'ALL', name: 'All six', rows }];
const out = { generatedAt: new Date().toISOString(), range: RANGE, boot: BOOT, low: {}, high: {} };
for (const g of groups) {
  out.low[g.key] = {
    noPirate: compare(g.rows, (r) => r.low.current, (r) => r.low.noPirate, (r) => r.obsMin, 11 + g.key.length),
    omOnly: compare(g.rows, (r) => r.low.current, (r) => r.low.omOnly, (r) => r.obsMin, 13 + g.key.length),
    pirateHalf: compare(g.rows, (r) => r.low.current, (r) => r.low.pirateHalf, (r) => r.obsMin, 19 + g.key.length),
    median3: compare(g.rows, (r) => r.low.current, (r) => r.low.median3, (r) => r.obsMin, 23 + g.key.length),
  };
  out.high[g.key] = Object.fromEntries(READ_HOURS.map((H) => [H, compare(g.rows, (r) => r.high[`current@${H}`], (r) => r.high[`fullDayOnly@${H}`], (r) => r.obsMax, 17 + H + g.key.length)]));
}

// ---- no Tomorrow.io (what switching it off would do) ----
const brier = (rs, k) => { const ok = rs.filter((r) => isNum(r[k]) && typeof r.y === 'boolean'); return { n: ok.length, brier: rnd(mean(ok.map((r) => (r[k] / 100 - (r.y ? 1 : 0)) ** 2)), 4) }; };
out.noTI = {};
for (const g of groups) { const hr = hourRows.filter((r) => g.key === 'ALL' || r.icao === g.key); const dr = g.rows.map((r) => ({ ...r, y: r.obsRain })); out.noTI[g.key] = { high6: compare(g.rows, (r) => r.high.cur6, (r) => r.high.noTI6, (r) => r.obsMax, 41 + g.key.length), hourlyRain: { cur: brier(hr, 'cur'), noTI: brier(hr, 'noTI') }, dailyRain: { cur: brier(dr.map((r) => ({ ...r, cur: r.rainCur })), 'cur'), noTI: brier(dr.map((r) => ({ ...r, noTI: r.rainNoTI })), 'noTI') } }; }
// ---- cut-off sweep: every read hour 12..23, pooled over those hours ----
out.cutSweep = {};
for (const g of groups) { out.cutSweep[g.key] = {}; for (const CUT of [13, 14, 15, 16, 17, 18, 19]) { const perHour = {}; for (let H = 12; H <= 23; H++) perHour[H] = compare(g.rows, (r) => r.high['cur@' + H], (r) => r.high['cut' + CUT + '@' + H], (r) => r.obsMax, 31 + CUT + H + g.key.length); out.cutSweep[g.key][CUT] = perHour; } }
// ---- report ----
const clear = (c) => c.ci[1] < 0 ? '**clearly better**' : c.ci[0] > 0 ? 'worse' : 'not distinguishable';
const md = [`# Forecast candidates — launch run (${out.generatedAt.slice(0, 10)})`, '',
  `Same days, truth and stand-ins as \`blend-vs-sources.mjs\` (${RANGE.from} → ${RANGE.to}, six airports, ${rows.length} scored days). "Clearly better" = the ${BOOT}-draw bootstrap 95% interval of (candidate − current) MAE lies wholly below zero. "Within 1 °C" = share of days the forecast was within 1 °C of the airport.`, '',
  '## 1. The day\'s low (as served at 06:00; the same weights make every day\'s low, incl. tomorrow\'s on the night Home)', '',
  '| airport | days | current MAE (bias) · within 1 °C | drop Pirate | Open-Meteo alone |', '|---|---:|---|---|---|'];
for (const g of groups) {
  const a = out.low[g.key].noPirate, b = out.low[g.key].omOnly;
  md.push(`| ${g.name} | ${a.n} | ${a.current.mae} (${a.current.bias}) · ${a.current.within1C}% | ${a.candidate.mae} (${a.candidate.bias}) · ${a.candidate.within1C}% — ${clear(a)} [${a.ci.join(', ')}] | ${b.candidate.mae} (${b.candidate.bias}) · ${b.candidate.within1C}% — ${clear(b)} [${b.ci.join(', ')}] |`);
}
md.push('', '## 2. The day\'s high read later in the day — current vs "only sources that forecast the whole day vote after noon"', '',
  `| airport | ${READ_HOURS.map((H) => `${String(H).padStart(2, '0')}:00`).join(' | ')} |`, `|---|${READ_HOURS.map(() => '---').join('|')}|`);
for (const g of groups) md.push(`| ${g.name} | ${READ_HOURS.map((H) => { const c = out.high[g.key][H]; return `${c.current.mae} → ${c.candidate.mae} (bias ${c.current.bias} → ${c.candidate.bias}) ${c.ci[1] < 0 ? '✔' : c.ci[0] > 0 ? '✘' : '='}`; }).join(' | ')} |`);
md.push('', '✔ clearly better · = not distinguishable · ✘ worse. Before noon the candidate is identical to current by construction.');
mkdirSync(path.join(ACCURACY_ROOT, 'results'), { recursive: true });
writeFileSync(path.join(ACCURACY_ROOT, 'results', 'forecast-candidates.json'), JSON.stringify(out, null, 1));
writeFileSync(path.join(ACCURACY_ROOT, 'results', 'forecast-candidates-days.json'), JSON.stringify(rows.map((r) => ({ icao: r.icao, date: r.date, obsMax: r.obsMax, obsMin: r.obsMin, low: r.low, high6: r.high['current@6'], high18: r.high['current@18'], high18Fix: r.high['cut17@18'] }))));
writeFileSync(path.join(ACCURACY_ROOT, 'results', 'forecast-candidates.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
