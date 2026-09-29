// The stations scorer (PLAN.md §3–§5 with the §8 amendments). Committed before it is run.
//   node review/accuracy/stations/score.mjs   → stations/results-score.json + results-score.txt
// Rules: M today (production's hero Windy rung, api/_lib code), S = M or the live station's latest usable report is
// pumping within F, SC = S or the positive station-minus-model gap, fading over T, lifts the numbers over the line.
// Decision instants at HH:30 UTC; truth = the next report; each instant weighs 1/k (k instants share that report).
// Wind: own rows at the 16 airports (the live stations) and cross rows (an airport's report → a scored station within
// D that passes the geometry, M and truth at that station); SYNOP own rows are report-only (their feed is not
// licensed for live use, §8). Rain and fog: own rows at the airports that report weather.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSynop } from '../v7/synop7.mjs';
import { DATA as V7DATA } from '../v7/common.mjs';
import { VARIANTS, productionWeights } from '../v2/temps-replay.mjs';
import { loadRuns, loadHist, isNum, round } from '../v2/lib.mjs';
import { shapeWind, windLine } from '../../../api/_lib/wind.js';
import { gustRuleAt, gustFactorAt } from '../../../api/_lib/gusts.js';
import { GUST_TABLE } from '../../../api/_lib/gust-table.js';
import { regionOf } from '../../../api/_lib/regions.js';
import { scoredStations } from './stations.mjs';
import { ensure, coastPoints, linePoints, kmBetween } from './geo.mjs';
import { geoPasses, isPumping, isCalm } from './pairs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PAIRS = JSON.parse(readFileSync(path.join(here, 'results-pairs.json'), 'utf8'));
const D = PAIRS.D;                                         // { coast, inland } km, learned March–June
const L_METAR = 10 * 60e3, L_SYNOP = 60 * 60e3;            // PLAN §3.2 (the probe's SYNOP p90 is reported, §8)
const WINDOW = { 1: 90 * 60e3, 3: 3.5 * 3600e3, 6: 6.5 * 3600e3 };
const F_GRID = [1.5, 2.5, 3.5, 4.5, 6.5, 7.5, 9.5], T_GRID = [3, 6, 9, 12], FR_GRID = [1.5, 2.5, 3.5];
const TUNE_BUDGET = 1.0, CATCH_FLOOR = 0.05, PROOF_BUDGET = 1.5, PROOF_BUDGET_HI = 3;
const START = Date.UTC(2026, 2, 1) - 2 * 3600e3;          // 1 March 00:00 SAST
const PROOF_FROM = Date.UTC(2026, 6, 1) - 2 * 3600e3;     // 1 July 00:00 SAST
const WIND_END = Date.UTC(2026, 8, 28, 12, 0), WET_END = Date.UTC(2026, 8, 24, 22, 0);   // 24 Sept 23:59 SAST
const GUESSES = [
  { name: 'old harness', mean: VARIANTS['old harness'], gust: ['best_match', 'ecmwf_ifs025', 'gfs_seamless'], rain: ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'] },
  { name: 'ECMWF-heavy', mean: VARIANTS['ECMWF-heavy'], gust: ['best_match', 'ecmwf_ifs025', 'ecmwf_ifs025'], rain: ['best_match', 'ecmwf_ifs025', 'icon_seamless', 'best_match', 'best_match'] },
  { name: 'mixed', mean: VARIANTS.mixed, gust: ['best_match', 'best_match', 'gfs_seamless'], rain: ['best_match', 'meteofrance_seamless', 'gfs_seamless', 'best_match', 'icon_seamless'] },
];
const V7 = JSON.parse(readFileSync(path.join(here, '../v7/results-score7.json'), 'utf8'));
const GUST_SCALE = V7.fidelity?.gustScale ?? 1;           // §8.8 — carried over from v7
const STRAND = { lat: -34.1408, lon: 18.8483 };
const sastKey = (ms) => new Date(ms + 2 * 3600e3).toISOString().slice(0, 13);
const maxOf = (a) => { const v = a.filter(isNum); return v.length ? Math.max(...v) : null; };
const out = { generatedAt: new Date().toISOString(), plan: 'review/accuracy/stations/PLAN.md (§8 amendments)', D, L: { metarMin: 10, synopMin: 60 }, gustScale: GUST_SCALE };

// ---------------- reports ----------------
const synop = loadSynop();
const stations = scoredStations(synop);
const airports = stations.filter((s) => s.kind === 'metar');
const KT = 1.852, MI = 1.609344;
function metarReports(id) {
  const lines = readFileSync(path.join(V7DATA, `metar-${id}.csv`), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  const H = lines[0].split(','), ix = (k) => H.indexOf(k), out = [];
  for (const l of lines.slice(1)) {
    const c = l.split(','); if (c.length < H.length) continue;
    const n = (k) => { const v = c[ix(k)]; return v === 'M' || v === '' || v === undefined ? null : Number(v); };
    const t = Date.parse(c[ix('valid')].replace(' ', 'T') + 'Z'); if (!Number.isFinite(t)) continue;
    const sknt = n('sknt'); if (sknt === null) continue;
    const toks = String(c[ix('wxcodes')] ?? '').split(/\s+/).filter((x) => x && x !== 'M');
    const bare = toks.map((x) => x.replace(/^[+-]/, '')).filter((x) => !x.startsWith('VC') && !x.startsWith('RE'));
    const vis = n('vsby') === null ? null : n('vsby') * MI;
    out.push({ t, mean: sknt * KT, gust: n('gust') === null ? null : n('gust') * KT, wx: true,
      rain: bare.some((x) => /RA|DZ/.test(x)),
      fog: bare.some((x) => x === 'FG' || x === 'FZFG') && isNum(vis) && vis < 1,
      vis });
  }
  return out.sort((a, b) => a.t - b.t);
}
const reportsOf = new Map();
for (const s of stations) {
  if (s.kind === 'metar') reportsOf.set(s.id, metarReports(s.id));
  else reportsOf.set(s.id, [...synop.get(s.id).values()].map((r) => ({ t: r.utc, mean: r.kph, gust: r.gustKph, wx: false })).sort((a, b) => a.t - b.t));
}
// Airports without their own model file use their SYNOP twin's (within 3 km, the same grid point), as v7 did.
const modelIdOf = (s) => {
  if (existsSync(path.join(V7DATA, `om-${s.id}.json`))) return s.id;
  const twin = stations.find((x) => x.kind === 'synop' && kmBetween(x.lat, x.lon, s.lat, s.lon) <= 3 && existsSync(path.join(V7DATA, `om-${x.id}.json`)));
  return twin?.id ?? null;
};

// ---------------- the models at a place: M's numbers and decision per SAST hour, per guess ----------------
const modelCache = new Map();
function modelAt(p) {                                     // p: { id(for the file), lat, lon }
  const fid = p.modelId;
  const ck = `${fid}|${p.lat}|${p.lon}`;
  if (modelCache.has(ck)) return modelCache.get(ck);
  const j = JSON.parse(readFileSync(path.join(V7DATA, `om-${fid}.json`), 'utf8'));
  const jb = JSON.parse(readFileSync(path.join(V7DATA, `omb-${fid}.json`), 'utf8'));
  const H = { ...j.hourly, ...jb.hourly }, highs = {};
  const models = [...new Set(GUESSES.flatMap((g) => [...g.mean, ...g.gust]))];
  for (let i = 0; i < H.time.length; i++) for (const mo of models) { const tt = H[`temperature_2m_${mo}`]?.[i]; if (isNum(tt)) { const k = `${mo}|${H.time[i].slice(0, 10)}`; highs[k] = Math.max(highs[k] ?? -99, tt); } }
  const rule = gustRuleAt(p.lat, p.lon);
  const m = new Map();
  for (let i = 0; i < H.time.length; i++) {
    const key = H.time[i].slice(0, 13), day = key.slice(0, 10), month = Number(day.slice(5, 7)), hour = Number(key.slice(11, 13));
    const dirM = H.wind_direction_10m_best_match?.[i];
    const corr = gustFactorAt(p.lat, p.lon, dirM);
    const headF = corr.factor !== 1 && GUST_TABLE.stations.find((s) => s.id === corr.station)?.headline !== false ? corr.factor : 1;
    const per = GUESSES.map((g) => {
      const slots = g.mean.map((mo) => { const v = H[`wind_speed_10m_${mo}`]?.[i]; return isNum(v) ? v : null; });
      if (!isNum(slots[0])) return null;
      const { W } = productionWeights(g.mean.map((mo) => highs[`${mo}|${day}`] ?? null), p.lat, p.lon);
      let sw = 0, ws = 0; slots.forEach((v, k) => { if (isNum(v) && W[k] > 0) { sw += v * W[k]; ws += W[k]; } });
      const raw = ws ? Math.round((sw / ws) * 10) / 10 : null;
      const shaped = shapeWind({ raw, values: slots.filter(isNum), slots, kind: 'now', lat: p.lat, lon: p.lon, month, hour });
      const line = windLine(shaped);
      const gusts = g.gust.map((mo) => { const v = H[`wind_gusts_10m_${mo}`]?.[i]; return isNum(v) ? v * GUST_SCALE : null; });
      const rawGust = maxOf(gusts);
      const heroGust = isNum(rawGust) ? rawGust * headF : null;
      // production's rung + B-2 consensus (as v7 score7.mjs windy(), with the place's own rule and correction)
      const G = rule.gustLineKph, K = rule.sourcesAt25;
      const cg = gusts.map((x) => (isNum(x) ? x * headF : null));
      let fire = (isNum(line.kph) && line.kph >= line.thresholdKph) || (isNum(heroGust) && heroGust >= G) || (K > 0 && slots.filter((v) => isNum(v) && v >= 25).length >= K);
      if (fire && slots.filter(isNum).length >= 3) {
        let sup = 0;
        slots.forEach((w, k) => { const gg = k < 3 ? cg[k] : null; if ((isNum(w) && w * line.sourceFactor >= line.thresholdKph * 0.8) || (isNum(gg) && gg >= G * 0.8)) sup++; });
        if (sup < 2) fire = false;
      }
      return { windy: fire, shownMean: shaped.kph, lineKph: line.kph, lineAt: line.thresholdKph, shownGust: isNum(rawGust) ? rawGust * (corr.factor ?? 1) : null, heroGust, gustLine: G };
    });
    m.set(key, per);
  }
  modelCache.set(ck, m);
  return m;
}

// ---------------- the replay ----------------
function lastUsable(reps, tau, L, maxAgeMs) {
  // binary search: last report with t + L <= tau
  let lo = 0, hi = reps.length - 1, best = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (reps[mid].t + L <= tau) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  if (best < 0) return null;
  const r = reps[best];
  return tau - r.t <= maxAgeMs ? r : null;
}
/**
 * Rows for one (A → B) pair: A's reports drive S/SC, B's reports are the truth, M is at B. A === B for own rows.
 * Each row: { tau, w (1/k), week, proof, truth, perGuess: [{ M, mShownMean, mShownGust, gapMean, gapGust, lineKph,
 * lineAt, heroGust, gustLine }], r (A's latest usable report within 12 h), cadenceA }.
 */
function windRows(A, B, kind) {
  const repA = reportsOf.get(A.id), repB = reportsOf.get(B.id);
  const LA = A.kind === 'metar' ? L_METAR : L_SYNOP;
  const model = modelAt({ modelId: modelIdOf(B), lat: B.lat, lon: B.lon });
  const rows = [];
  let prevT = null;
  for (const T of repB) {
    if (T.t < START || T.t > WIND_END) { prevT = T.t; continue; }
    const from = prevT ?? T.t - WINDOW[B.cadence];
    prevT = T.t;
    const inst = [];
    for (let tau = Math.ceil((from - 30 * 60e3) / 3600e3) * 3600e3 + 30 * 60e3; tau <= T.t; tau += 3600e3) {
      if (tau <= from || T.t - tau > WINDOW[B.cadence] || tau < START) continue;
      inst.push(tau);
    }
    if (!inst.length) continue;
    const truth = { mean: T.mean, gust: T.gust, pumping: isPumping(T), calm: isCalm(T) };
    for (const tau of inst) {
      const hourKey = sastKey(Math.floor(tau / 3600e3) * 3600e3);
      const mNow = model.get(hourKey); if (!mNow || mNow.some((x) => !x)) continue;
      const r = lastUsable(repA, tau, LA, 12 * 3600e3);
      const rKey = r ? sastKey(Math.floor(r.t / 3600e3) * 3600e3) : null;
      const mAtR = rKey ? model.get(rKey) : null;
      rows.push({ tau, tT: T.t, w: 1 / inst.length, proof: tau >= PROOF_FROM, week: Math.floor((tau - START) / (7 * 864e5)), day: sastKey(tau).slice(0, 10), truth, B: B.id, A: A.id, kind,
        r: r ? { age: (tau - r.t) / 3600e3, pumping: isPumping(r), calm: isCalm(r), mean: r.mean, gust: r.gust } : null,
        g: mNow.map((x, gi) => ({ M: x.windy, mShownMean: x.shownMean, mShownGust: x.shownGust, lineKph: x.lineKph, lineAt: x.lineAt, heroGust: x.heroGust, gustLine: x.gustLine,
          gapMean: r && mAtR?.[gi] && isNum(mAtR[gi].shownMean) ? r.mean - mAtR[gi].shownMean : null,
          gapGust: r && isNum(r.gust) && mAtR?.[gi] && isNum(mAtR[gi].heroGust) ? r.gust - mAtR[gi].heroGust : null })) });
    }
  }
  return rows;
}
const S = (row, F) => Boolean(row.r && row.r.pumping && row.r.age <= F);
const decide = (rule, row, gi, P) => {
  const x = row.g[gi];
  if (rule === 'M') return x.M;
  if (rule === 'S') return x.M || S(row, P.F);
  if (rule === 'veto') return S(row, P.F) || (x.M && !(row.r && row.r.calm && row.r.age <= P.F));
  const fade = row.r ? Math.max(0, 1 - row.r.age / P.T) : 0;
  const up = (gap) => (isNum(gap) && gap > 0 ? gap * fade : 0);
  const both = (gap) => (isNum(gap) ? gap * fade : 0);
  if (rule === 'SC') return x.M || S(row, P.F) || (isNum(x.lineKph) && x.lineKph + up(row.g[gi].gapMean) >= x.lineAt) || (isNum(x.heroGust) && x.heroGust + up(x.gapGust) >= x.gustLine);
  if (rule === 'SC-both') return S(row, P.F) || (isNum(x.lineKph) && x.lineKph + both(x.gapMean) >= x.lineAt) || (isNum(x.heroGust) && x.heroGust + both(x.gapGust) >= x.gustLine);
  throw new Error(rule);
};
/** Shown numbers under a rule (for the off-by, §3.4). */
const shown = (rule, row, gi, P) => {
  const x = row.g[gi];
  if (rule !== 'M' && S(row, P.F)) return { mean: row.r.mean, gust: row.r.gust };
  if (rule === 'SC' || rule === 'SC-both') {
    const fade = row.r ? Math.max(0, 1 - row.r.age / P.T) : 0;
    return { mean: isNum(x.mShownMean) ? Math.max(0, x.mShownMean + (x.gapMean ?? 0) * fade) : null, gust: isNum(x.mShownGust) ? Math.max(0, x.mShownGust + (x.gapGust ?? 0) * fade) : null };
  }
  return { mean: x.mShownMean, gust: x.mShownGust };
};
function tally(rows, rule, gi, P) {
  let pw = 0, pc = 0, cw = 0, cf = 0, days = new Set(), reports = new Set();
  for (const r of rows) {
    const d = decide(rule, r, gi, P);
    if (r.truth.pumping) { pw += r.w; if (d) pc += r.w; days.add(r.day); reports.add(`${r.B}|${r.day}|${r.tau}`); }
    else if (r.truth.calm) { cw += r.w; if (d) cf += r.w; }
  }
  return { pumping: pw, caught: pw ? pc / pw : null, calm: cw, falsePer100: cw ? (100 * cf) / cw : null, days: days.size };
}
// paired 7-day block bootstrap of (rule − M) for caught (points) and false (per 100)
const rng = () => { let s = 7 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
function boot(rows, rule, gi, P) {
  // per-week sums [pumping w, caught by rule, caught by M, calm w, false by rule, false by M]; resample whole weeks
  const agg = new Map();
  for (const r of rows) {
    const a = agg.get(r.week) || agg.set(r.week, [0, 0, 0, 0, 0, 0]).get(r.week);
    if (r.truth.pumping) { a[0] += r.w; if (decide(rule, r, gi, P)) a[1] += r.w; if (r.g[gi].M) a[2] += r.w; }
    else if (r.truth.calm) { a[3] += r.w; if (decide(rule, r, gi, P)) a[4] += r.w; if (r.g[gi].M) a[5] += r.w; }
  }
  const weeks = [...agg.values()];
  const stat = (ws) => { const t = [0, 0, 0, 0, 0, 0]; for (const w of ws) for (let i = 0; i < 6; i++) t[i] += w[i]; return [t[0] ? (t[1] - t[2]) / t[0] : null, t[3] ? (100 * (t[4] - t[5])) / t[3] : null]; };
  const point = stat(weeks), rnd = rng(), c = [], f = [];
  for (let k = 0; k < 1000; k++) { const pk = []; for (let i = 0; i < weeks.length; i++) pk.push(weeks[Math.floor(rnd() * weeks.length)]); const [x, y] = stat(pk); if (isNum(x)) c.push(x); if (isNum(y)) f.push(y); }
  c.sort((a, b) => a - b); f.sort((a, b) => a - b);
  return { caught: { d: point[0], lo: q(c, 0.025), hi: q(c, 0.975) }, false: { d: point[1], lo: q(f, 0.025), hi: q(f, 0.975) } };
}

// ---------------- build rows ----------------
await ensure(stations.flatMap((s) => coastPoints(s.lat, s.lon)));
const own = [], cross = [], synopOwn = [];
for (const a of airports) { if (!modelIdOf(a)) { console.error(`${a.id}: no model file`); continue; } own.push(...windRows(a, a, 'own')); }
const crossPairs = [];
{
  const need = [];
  for (const a of airports) for (const b of stations) { const d = kmBetween(a.lat, a.lon, b.lat, b.lon); if (b.id !== a.id && d > 3 && d <= 40) need.push(...linePoints(a.lat, a.lon, b.lat, b.lon)); }
  await ensure(need);
  for (const a of airports) for (const b of stations) {
    const d = kmBetween(a.lat, a.lon, b.lat, b.lon);
    if (b.id === a.id || d <= 3 || d > 40 || !modelIdOf(b)) continue;
    const g = geoPasses(a, b);
    if (!g.ok || d > (g.coastal ? D.coast : D.inland)) continue;
    crossPairs.push({ a: a.id, b: b.id, km: round(d, 1), coastal: g.coastal });
    cross.push(...windRows(a, b, 'cross'));
  }
}
for (const s of stations.filter((x) => x.kind === 'synop' && modelIdOf(x))) synopOwn.push(...windRows(s, s, 'synop-own').map((r) => ({ ...r, cadence: s.cadence })));
const REGION = new Map(stations.map((b) => [b.id, kmBetween(b.lat, b.lon, STRAND.lat, STRAND.lon) <= 15 ? "Strand's zone" : regionOf(b.lat, b.lon)]));
const regionOfRow = (r) => REGION.get(r.B);
for (const r of [...own, ...cross, ...synopOwn]) r.region = regionOfRow(r);
out.crossPairs = crossPairs;
out.rowCounts = { own: own.length, cross: cross.length, synopOwn: synopOwn.length };

// ---------------- tune (March–June), nationally ----------------
const G3 = [0, 1, 2];
const avg = (f) => G3.reduce((s, gi) => s + f(gi), 0) / 3;
function tuneF(rows, rule, extra = {}) {
  const tr = rows.filter((r) => !r.proof);
  const mFalse = avg((gi) => tally(tr, 'M', gi, {}).falsePer100);
  const cand = [];
  for (const F of F_GRID) for (const T of rule === 'SC' ? T_GRID : [null]) {
    const P = { F, T, ...extra };
    const c = avg((gi) => tally(tr, rule, gi, P).caught), f = avg((gi) => tally(tr, rule, gi, P).falsePer100);
    cand.push({ F, T, caught: c, falsePer100: f, ok: f <= mFalse + TUNE_BUDGET });
  }
  const ok = cand.filter((x) => x.ok).sort((a, b) => b.caught - a.caught || a.F - b.F || (a.T ?? 0) - (b.T ?? 0));
  return { mFalse, chosen: ok[0] ?? null, grid: cand };
}
const live = [...own, ...cross];
const tS = tuneF(live, 'S');
const Fs = tS.chosen?.F ?? null;
const tSC = Fs ? (() => { const tr = live.filter((r) => !r.proof); const mF = avg((gi) => tally(tr, 'M', gi, {}).falsePer100);
  const cand = T_GRID.map((T) => { const P = { F: Fs, T }; return { F: Fs, T, caught: avg((gi) => tally(tr, 'SC', gi, P).caught), falsePer100: avg((gi) => tally(tr, 'SC', gi, P).falsePer100) }; });
  const ok = cand.filter((x) => x.falsePer100 <= mF + TUNE_BUDGET).sort((a, b) => b.caught - a.caught || a.T - b.T);
  return { chosen: ok[0] ?? null, grid: cand }; })() : null;
out.tune = { S: { mFalse: tS.mFalse, chosen: tS.chosen, grid: tS.grid }, SC: tSC };
// SYNOP report-only: F per cadence class
out.tuneSynop = {};
for (const cad of [1, 3, 6]) { const rs = synopOwn.filter((r) => r.cadence === cad); if (rs.length) out.tuneSynop[cad] = tuneF(rs, 'S'); }

// ---------------- prove (July → 28 Sept 12Z), per region ----------------
function verdict(rows, rule, P) {
  const pr = rows.filter((r) => r.proof);
  const per = G3.map((gi) => ({ guess: GUESSES[gi].name, M: tally(pr, 'M', gi, P), R: tally(pr, rule, gi, P), boot: boot(pr, rule, gi, P) }));
  const pumpReports = new Set(pr.filter((r) => r.truth.pumping).map((r) => `${r.B}|${r.tT}`)).size;
  const pumpDays = new Set(pr.filter((r) => r.truth.pumping).map((r) => r.day)).size;
  const b1 = per.every((x) => isNum(x.boot.caught.d) && x.boot.caught.d >= CATCH_FLOOR && isNum(x.boot.caught.lo) && x.boot.caught.lo > 0);
  const b2 = per.every((x) => isNum(x.boot.false.d) && x.boot.false.d <= PROOF_BUDGET && isNum(x.boot.false.hi) && x.boot.false.hi <= PROOF_BUDGET_HI);
  const b3 = pumpReports >= 30 && pumpDays >= 6;
  return { per, pumpReports, pumpDays, b1, b2, b3, pass: b1 && b2 && b3 };
}
const regions = [...new Set(live.map((r) => r.region))].sort();
out.regions = {};
for (const g of regions) {
  const o = live.filter((r) => r.region === g && r.kind === 'own'), c = live.filter((r) => r.region === g && r.kind === 'cross');
  const res = { ownStations: [...new Set(o.map((r) => r.B))], crossPairs: crossPairs.filter((p) => regionOfRow({ B: p.b }) === g) };
  for (const [rule, P] of [['S', { F: Fs }], ['SC', { F: Fs, T: tSC?.chosen?.T }], ['veto', { F: Fs }], ['SC-both', { F: Fs, T: tSC?.chosen?.T }]]) {
    if (!Fs || (rule.startsWith('SC') && !tSC?.chosen)) continue;
    const vo = o.length ? verdict(o, rule, P) : null, vc = c.length ? verdict(c, rule, P) : null;
    // leave-one-out: drop the own station with the most pumping proof truths (n/a with one)
    let loo = 'n/a (one station)';
    if (res.ownStations.length > 1) {
      const cnt = {}; for (const r of o) if (r.proof && r.truth.pumping) cnt[r.B] = (cnt[r.B] ?? 0) + r.w;
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
      loo = top ? verdict(o.filter((r) => r.B !== top), rule, P).pass : 'n/a';
    }
    const pass = Boolean(vo?.pass) && (vc ? vc.pass : true) && (loo === true || typeof loo === 'string');
    res[rule] = { own: vo, cross: vc, leaveOneOut: loo, persistenceOnly: !vc, pass, blocked: Boolean(vo && !vo.b2) || Boolean(vc && !vc.b2) };
  }
  out.regions[g] = res;
}
// shown-number off-by (proof, own rows, per rule): mean absolute error of the shown mean and gust vs the truth report
out.offBy = {};
for (const g of regions) {
  const pr = live.filter((r) => r.region === g && r.proof);
  const mae = (rule, P, f) => avg((gi) => { let s = 0, n = 0; for (const r of pr) { const v = shown(rule, r, gi, P)[f], t = r.truth[f]; if (isNum(v) && isNum(t)) { s += Math.abs(v - t) * r.w; n += r.w; } } return n ? s / n : NaN; });
  out.offBy[g] = {};
  for (const [rule, P] of [['M', {}], ['S', { F: Fs }], ['SC', { F: Fs, T: tSC?.chosen?.T }]]) if (rule === 'M' || Fs) out.offBy[g][rule] = { mean: round(mae(rule, P, 'mean'), 2), gust: round(mae(rule, P, 'gust'), 2) };
}
// SYNOP report-only, per region (what a licensed SAWS feed would do): S vs M, the class F
out.synopReportOnly = {};
for (const g of [...new Set(synopOwn.map((r) => r.region))].sort()) {
  const rs = synopOwn.filter((r) => r.region === g && r.proof);
  const Pof = (r) => ({ F: out.tuneSynop[r.cadence]?.chosen?.F ?? 0 });
  const t = (rule) => avg((gi) => { let pw = 0, pc = 0; for (const r of rs) if (r.truth.pumping) { pw += r.w; if (decide(rule, r, gi, Pof(r))) pc += r.w; } return pw ? pc / pw : NaN; });
  const f = (rule) => avg((gi) => { let cw = 0, cf = 0; for (const r of rs) if (r.truth.calm) { cw += r.w; if (decide(rule, r, gi, Pof(r))) cf += r.w; } return cw ? (100 * cf) / cw : NaN; });
  out.synopReportOnly[g] = { stations: new Set(rs.map((r) => r.B)).size, pumping: round(rs.filter((r) => r.truth.pumping).reduce((s, r) => s + r.w, 0), 1), caughtM: round(t('M'), 3), caughtS: round(t('S'), 3), falseM: round(f('M'), 2), falseS: round(f('S'), 2), falseVeto: round(f('veto'), 2), caughtVeto: round(t('veto'), 3) };
}
// Al's morning at Strand (68911, 6-hourly): the F chosen for 6-hourly stations against 29 Sept 08:01 SAST (00Z report, 6 h old)
out.strandMorning = { latestReportAgeH: 6.02, F6: out.tuneSynop[6]?.chosen?.F ?? null, wouldHold: (out.tuneSynop[6]?.chosen?.F ?? 0) >= 6.02 };

// ---------------- rain and fog: own rows at the airports that report weather ----------------
const NO_WX = new Set(['FALW', 'FAHS', 'FAWB']);
const FAMILY = { best_match: 'ECMWF', ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS', icon_seamless: 'ICON', ukmo_seamless: 'UKMO', meteofrance_seamless: 'MF' };
const RAINY = (c) => isNum(c) && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95);
const metProxy = (mm) => (!isNum(mm) ? null : mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80);
const wavg = (pairs) => { let s = 0, w = 0; for (const [v, k] of pairs) if (isNum(v)) { s += v * k; w += k; } return w ? s / w : null; };
const HW = { OM: 0.30, WA: 0.22, MET: 0.20, TI: 0.15 };
const FOG_STRICT = ['Western Cape', 'Garden Route', 'Eastern Cape', 'KZN coast', 'Lowveld'];
const rhOf = (t, d) => (isNum(t) && isNum(d) ? 100 * Math.exp((17.625 * d) / (243.04 + d)) / Math.exp((17.625 * t) / (243.04 + t)) : null);
const wet = [];
for (const a of airports.filter((x) => !NO_WX.has(x.id))) {
  const R = {}, Hh = {};
  for (const mo of Object.keys(FAMILY)) R[mo] = loadRuns(a.id, mo);
  for (const mo of ['best_match', 'ecmwf_ifs025', 'gfs_seamless']) Hh[mo] = loadHist(a.id, mo);
  if (Object.values(R).some((x) => !x) || Object.values(Hh).some((x) => !x)) { console.error(`${a.id}: rain/fog model data missing`); continue; }
  const strict = FOG_STRICT.includes(regionOf(a.lat, a.lon));
  const reps = reportsOf.get(a.id);
  let prevT = null;
  for (let j = 0; j < reps.length; j++) {
    const T = reps[j];
    if (T.t < START || T.t > WET_END) { prevT = T.t; continue; }
    const from = prevT ?? T.t - WINDOW[1]; prevT = T.t;
    const inst = []; for (let tau = Math.ceil((from - 30 * 60e3) / 3600e3) * 3600e3 + 30 * 60e3; tau <= T.t; tau += 3600e3) if (tau > from && T.t - tau <= WINDOW[1] && tau >= START) inst.push(tau);
    if (!inst.length) continue;
    const near = reps.filter((x) => Math.abs(x.t - T.t) <= 3600e3);
    const truth = { rain: T.rain, rainNear: near.some((x) => x.rain), fog: T.fog, visNear: isNum(T.vis) && T.vis < 2 };
    for (const tau of inst) {
      const k = sastKey(Math.floor(tau / 3600e3) * 3600e3);
      const at = (mo) => R[mo].get(k), pp = (mo) => Hh[mo]?.get(k)?.pp;
      const mRain = GUESSES.map((g) => {
        const S5 = g.rain, fams = new Map();
        for (const mo of S5) { const c = at(mo)?.code; const f = FAMILY[mo]; if (!fams.has(f) || mo === 'best_match') fams.set(f, c); }
        const votes = [...fams.values()].filter(RAINY).length;
        const chance = wavg([[pp(S5[0]), HW.OM], [pp(S5[1]), HW.WA], [metProxy(at(S5[3])?.p0), HW.MET], [pp(S5[4]), HW.TI]]);
        const amount = wavg([[at(S5[0])?.p0, HW.OM], [at(S5[1])?.p0, HW.WA], [at(S5[3])?.p0, HW.MET], [at(S5[4])?.p0, HW.TI]]);
        return votes >= 2 && isNum(chance) && chance >= 90 && isNum(amount) && amount >= 2;
      });
      const r0 = at('best_match'), h0 = Hh.best_match.get(k);
      const rh = rhOf(r0?.t0, r0?.dew), spread = isNum(r0?.t0) && isNum(r0?.dew) ? r0.t0 - r0.dew : null;
      const mFog = Boolean(h0 && isNum(h0.vis) && h0.vis < 1500 && isNum(rh) && rh >= (strict ? 95 : 90) && isNum(spread) && spread <= 2
        && (!isNum(h0.pp) || h0.pp < 30) && (!isNum(r0?.p0) || r0.p0 < 0.2) && (!strict || (isNum(r0?.w0) && r0.w0 <= 10)));
      const r = lastUsable(reps, tau, L_METAR, 12 * 3600e3);
      wet.push({ tau, tT: T.t, w: 1 / inst.length, proof: tau >= PROOF_FROM, week: Math.floor((tau - START) / (7 * 864e5)), day: sastKey(tau).slice(0, 10), id: a.id, region: regionOf(a.lat, a.lon),
        truth, mRain, mFog, r: r ? { age: (tau - r.t) / 3600e3, rain: r.rain, fog: r.fog } : null });
    }
  }
}
function wetTally(rows, what, F, gi) {
  const fire = (r) => Boolean(r.r && r.r[what] && r.r.age <= F);
  const m = (r) => (what === 'rain' ? r.mRain[gi] : r.mFog);
  let tw = 0, tc = 0, tcM = 0, dw = 0, df = 0, dfM = 0, own = 0, ownT = 0, ownNear = 0, mc = 0, mT = 0;
  for (const r of rows) {
    const S1 = m(r) || fire(r), M1 = m(r), T = r.truth[what];
    const near = what === 'rain' ? r.truth.rainNear : r.truth.visNear || r.truth.fog;
    if (T) { tw += r.w; if (S1) tc += r.w; if (M1) tcM += r.w; } else { dw += r.w; if (S1) df += r.w; if (M1) dfM += r.w; }
    if (fire(r) && !M1) { own += r.w; if (T) ownT += r.w; if (near) ownNear += r.w; }
    if (M1) { mc += r.w; if (T) mT += r.w; }
  }
  return { truths: tw, caughtS: tw ? tc / tw : null, caughtM: tw ? tcM / tw : null, falseS: dw ? (100 * df) / dw : null, falseM: dw ? (100 * dfM) / dw : null,
    ownCalls: own, ownPrecision: own ? ownT / own : null, ownNear: own ? ownNear / own : null, mCalls: mc, mPrecision: mc ? mT / mc : null };
}
function wetBoot(rows, what, F, gi) {
  const agg = new Map();
  for (const r of rows) {
    if (!r.truth[what]) continue;
    const a = agg.get(r.week) || agg.set(r.week, [0, 0, 0]).get(r.week);
    const M1 = what === 'rain' ? r.mRain[gi] : r.mFog, S1 = M1 || Boolean(r.r && r.r[what] && r.r.age <= F);
    a[0] += r.w; if (S1) a[1] += r.w; if (M1) a[2] += r.w;
  }
  const weeks = [...agg.values()];
  const stat = (ws) => { const t = [0, 0, 0]; for (const w of ws) for (let i = 0; i < 3; i++) t[i] += w[i]; return t[0] ? (t[1] - t[2]) / t[0] : null; };
  const point = stat(weeks), rnd = rng(), a = [];
  for (let k = 0; k < 1000; k++) { const pk = []; for (let i = 0; i < weeks.length; i++) pk.push(weeks[Math.floor(rnd() * weeks.length)]); const v = stat(pk); if (isNum(v)) a.push(v); }
  a.sort((x, y) => x - y);
  return { d: point, lo: q(a, 0.025), hi: q(a, 0.975) };
}
out.wet = {};
for (const what of ['rain', 'fog']) {
  const gis = what === 'rain' ? G3 : [0];
  const tr = wet.filter((r) => !r.proof), pr = wet.filter((r) => r.proof);
  const mFalse = avg((gi) => wetTally(tr, what, 0, what === 'rain' ? gi : 0).falseM);
  const grid = FR_GRID.map((F) => ({ F, caught: avg((gi) => wetTally(tr, what, F, what === 'rain' ? gi : 0).caughtS), falsePer100: avg((gi) => wetTally(tr, what, F, what === 'rain' ? gi : 0).falseS) }));
  const chosen = grid.filter((x) => x.falsePer100 <= mFalse + TUNE_BUDGET).sort((a, b) => b.caught - a.caught || a.F - b.F)[0] ?? null;
  const res = { tune: { mFalse, grid, chosen } };
  if (chosen) {
    const per = gis.map((gi) => ({ guess: GUESSES[gi].name, t: wetTally(pr, what, chosen.F, gi), boot: wetBoot(pr, what, chosen.F, gi) }));
    const truthReports = new Set(pr.filter((r) => r.truth[what]).map((r) => `${r.id}|${r.tT}`)).size;
    const truthDays = new Set(pr.filter((r) => r.truth[what]).map((r) => r.day)).size;
    const b1 = per.every((x) => isNum(x.boot.d) && x.boot.d >= CATCH_FLOOR && isNum(x.boot.lo) && x.boot.lo > 0);
    const b2 = per.every((x) => isNum(x.t.ownPrecision) && x.t.ownPrecision >= Math.max(0.6, (x.t.mPrecision ?? 0) - 0.05) && isNum(x.t.ownNear) && x.t.ownNear >= 0.8);
    const b3 = truthReports >= 30 && truthDays >= 6;
    const byRegion = {};
    for (const g of [...new Set(pr.map((r) => r.region))].sort()) {
      const t = wetTally(pr.filter((r) => r.region === g), what, chosen.F, 0);
      byRegion[g] = { ...t, blocked: t.ownCalls >= 10 && !(t.ownPrecision >= Math.max(0.6, (t.mPrecision ?? 0) - 0.05) && t.ownNear >= 0.8) };
    }
    Object.assign(res, { per, truthReports, truthDays, b1, b2, b3, pass: b1 && b2 && b3, byRegion });
  }
  out.wet[what] = res;
}

writeFileSync(path.join(here, 'results-score.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x instanceof Set ? [...x] : x), 1));
// ---------------- the text report ----------------
const pc = (x) => (isNum(x) ? `${(x * 100).toFixed(1)}%` : '—');
const iv = (b, pct = true) => (b && isNum(b.d) ? `${pct ? (b.d * 100).toFixed(1) : b.d.toFixed(2)} [${pct ? (b.lo * 100).toFixed(1) : b.lo?.toFixed(2)}, ${pct ? (b.hi * 100).toFixed(1) : b.hi?.toFixed(2)}]` : '—');
const L = [];
L.push(`STATIONS — D coast ${D.coast} km, inland ${D.inland} km; rows own ${own.length}, cross ${cross.length}, SYNOP own ${synopOwn.length}; cross pairs ${crossPairs.map((p) => `${p.a}→${p.b} ${p.km}km`).join(', ') || 'none'}`);
L.push(`TUNE S: F ${Fs} h (caught ${pc(tS.chosen?.caught)}, false ${tS.chosen?.falsePer100?.toFixed(2)} vs M ${tS.mFalse?.toFixed(2)}); SC: T ${tSC?.chosen?.T ?? '—'} h`);
L.push(`SYNOP F by cadence: ${Object.entries(out.tuneSynop).map(([c, t]) => `${c}-hourly ${t.chosen?.F ?? 'none'} h`).join(', ')}; Strand 08:01 (00Z, 6.0 h old) would hold: ${out.strandMorning.wouldHold}`);
for (const [g, res] of Object.entries(out.regions)) {
  L.push(`\n${g} — own: ${res.ownStations.join(' ') || '—'}; cross: ${res.crossPairs.map((p) => `${p.a}→${p.b}`).join(' ') || 'none (persistence only)'}`);
  for (const rule of ['S', 'SC', 'veto', 'SC-both']) {
    const v = res[rule]; if (!v) continue;
    const line = (x, lab) => (x ? `${lab}: ${x.per.map((p) => `${p.guess}: caught ${pc(p.M.caught)}→${pc(p.R.caught)} Δ${iv(p.boot.caught)}, false ${p.M.falsePer100?.toFixed(2)}→${p.R.falsePer100?.toFixed(2)} Δ${iv(p.boot.false, false)}`).join(' | ')}; pumping reports ${x.pumpReports} on ${x.pumpDays} days; bars ${x.b1 ? '1' : '-'}${x.b2 ? '2' : '-'}${x.b3 ? '3' : '-'}` : `${lab}: —`);
    L.push(`  ${rule}${rule === 'veto' || rule === 'SC-both' ? ' (report only)' : ''}: ${v.pass ? 'PASS' : v.blocked ? 'BLOCKED' : 'no'}${v.persistenceOnly ? ' (persistence only)' : ''}; leave-one-out ${v.leaveOneOut}`);
    L.push(`    ${line(v.own, 'own')}`); if (v.cross) L.push(`    ${line(v.cross, 'cross')}`);
  }
  const ob = out.offBy[g]; L.push(`  shown off-by (mean/gust km/h): ${Object.entries(ob).map(([k, v]) => `${k} ${v.mean}/${v.gust}`).join(' · ')}`);
}
L.push('\nSYNOP report-only (proof, what a licensed SAWS feed would do): region stations pumping caught M→S false M→S (veto false, veto caught)');
for (const [g, v] of Object.entries(out.synopReportOnly)) L.push(`  ${g}: ${v.stations} st, ${v.pumping} pumping; caught ${pc(v.caughtM)}→${pc(v.caughtS)}; false ${v.falseM}→${v.falseS} (veto ${v.falseVeto}, caught ${pc(v.caughtVeto)})`);
for (const what of ['rain', 'fog']) {
  const w = out.wet[what];
  L.push(`\n${what.toUpperCase()}: tune F ${w.tune.chosen?.F ?? 'none'} (M false ${w.tune.mFalse?.toFixed(2)}); ${w.pass ? 'PASS' : 'no'} bars ${w.b1 ? '1' : '-'}${w.b2 ? '2' : '-'}${w.b3 ? '3' : '-'}; truth reports ${w.truthReports} on ${w.truthDays} days`);
  for (const p of w.per ?? []) L.push(`  ${p.guess}: caught ${pc(p.t.caughtM)}→${pc(p.t.caughtS)} Δ${iv(p.boot)}; false/100 ${p.t.falseM?.toFixed(2)}→${p.t.falseS?.toFixed(2)}; S's own calls ${p.t.ownCalls?.toFixed(1)}: right ${pc(p.t.ownPrecision)}, around ${pc(p.t.ownNear)}; M's calls ${p.t.mCalls?.toFixed(1)} right ${pc(p.t.mPrecision)}`);
  for (const [g, t] of Object.entries(w.byRegion ?? {})) L.push(`    ${g}: own calls ${t.ownCalls.toFixed(1)} right ${pc(t.ownPrecision)} around ${pc(t.ownNear)}${t.blocked ? ' BLOCKED' : ''}`);
}
writeFileSync(path.join(here, 'results-score.txt'), L.join('\n') + '\n');
console.log(L.join('\n'));
