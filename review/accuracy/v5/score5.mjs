// WIND, GUSTS, THE SKY CALL, THE WIND HEADLINE — scored exactly as review/accuracy/v5/PLAN.md says, once.
//   node review/accuracy/v5/score5.mjs            → results/v5-score.json + a printed summary
// Tune 2025, prove 2026-01-01 → 09-24, 16 airports, three source guesses; the live recorder (real sources) as a
// guard; Strand's SYNOP station 68911 for the transfer and south-easter tests (PLAN §6).
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCORED, RUN_MODELS } from '../v2/stations.mjs';
import { loadObs, loadHist, days, hourKey, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, DATA, RESULTS } from '../v2/lib.mjs';
import { productionWeights, VARIANTS } from '../v2/temps-replay.mjs';
import { bootStat } from '../v4/lib4.mjs';
import { pickModalCloud } from '../../../api/weather.js';

const LIVE_DIR = process.env.PW_LIVE_DIR || 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const GUESSES = VARIANTS;                                   // [OM, WA, Pirate, MET, TI]
const GUST_GUESSES = {                                      // [OM, WA, Pirate] — only three models carry gusts
  'old harness': ['best_match', 'ecmwf_ifs025', 'gfs_seamless'],
  'ECMWF-heavy': ['best_match', 'ecmwf_ifs025', 'ecmwf_ifs025'],
  'mixed':       ['best_match', 'best_match', 'gfs_seamless'],
};
const G = Object.keys(GUESSES);
const PART = (h) => (h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
const PARTS = ['night', 'morning', 'afternoon', 'evening'], SEASONS = ['DJF', 'MAM', 'JJA', 'SON'];
const WINDY = 30, BIG_GUST = 55, T_GRID = [25, 27.5, 30, 32.5, 35];
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const median = (a) => { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return null; const k = v.length >> 1; return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2; };
const wavg = (vals, w) => { let s = 0, ws = 0; vals.forEach((v, i) => { if (isNum(v) && w[i] > 0) { s += v * w[i]; ws += w[i]; } }); return ws ? s / ws : null; };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const f1 = (l) => { const tp = l.filter((x) => x.p && x.t).length, fp = l.filter((x) => x.p && !x.t).length, fn = l.filter((x) => !x.p && x.t).length; return tp + fp + fn ? tp / (tp + (fp + fn) / 2) : null; };
const skyCat = (pct) => (!isNum(pct) ? null : pct < 30 ? 'clear' : pct < 55 ? 'partly' : 'cloudy');
const obsSky = (pct) => (!isNum(pct) ? null : pct <= 25 ? 'clear' : pct <= 50 ? 'partly' : 'cloudy'); // FEW 25 · SCT 50 · BKN 75 · OVC 100
const clear95 = (b, sign) => (b && isNum(b.lo) && isNum(b.hi) ? (sign < 0 ? b.hi < 0 : b.lo > 0) : false);

// ---------- loaders ----------
function loadRuns5(id, model) {
  const file = path.join(DATA, `runs-${id}-${model}.json`);
  if (!existsSync(file)) return null;
  const h = JSON.parse(readFileSync(file, 'utf8')).hourly;
  const out = new Map();
  for (let i = 0; i < h.time.length; i++) out.set(h.time[i].slice(0, 13), { t0: h.temperature_2m[i], w0: h.wind_speed_10m[i], w1: h.wind_speed_10m_previous_day1[i], cloud: h.cloud_cover[i], dir: h.wind_direction_10m?.[i] ?? null });
  return out;
}
function dayMax(runs, day) { let m = null; for (let h = 0; h < 24; h++) { const v = runs.get(hourKey(day, h))?.t0; if (isNum(v)) m = m === null ? v : Math.max(m, v); } return m; }

function buildRows(st, obsMap) {
  const runs = Object.fromEntries(RUN_MODELS.map((m) => [m, loadRuns5(st.id, m)]));
  if (RUN_MODELS.some((m) => !runs[m])) { console.error(`${st.id}: runs missing`); return []; }
  const hist = Object.fromEntries(['best_match', 'ecmwf_ifs025', 'gfs_seamless'].map((m) => [m, loadHist(st.id, m)]));
  const rows = [];
  for (const d of days('2025-01-01', '2026-09-24')) {
    const highs = Object.fromEntries(RUN_MODELS.map((m) => [m, dayMax(runs[m], d)]));
    for (let h = 0; h < 24; h++) {
      const k = hourKey(d, h), o = obsMap.get(k);
      if (!o) continue;
      const m = Object.fromEntries(RUN_MODELS.map((mm) => [mm, runs[mm].get(k) || {}]));
      rows.push({ id: st.id, region: st.region, lat: st.lat, lon: st.lon, day: d, h, week: week(d), season: SEASON(d), part: PART(h),
        obsWind: o.windKph, obsGust: o.gustKph, obsCloud: o.cloudPct, highs, m,
        gust: Object.fromEntries(Object.entries(hist).map(([mm, H]) => [mm, H?.get(k)?.gust ?? null])) });
    }
  }
  return rows;
}

// ---------- the rules, per guess ----------
function slotVals(r, guess, field) { return GUESSES[guess].map((mm) => r.m[mm]?.[field]); }
function weights(r, guess) { const s = GUESSES[guess]; return productionWeights([r.highs[s[0]], r.highs[s[1]], r.highs[s[2]], r.highs[s[3]], r.highs[s[4]]], r.lat, r.lon).W; }
const HOURLY = [0, 1, 3, 4];   // the hourly sources [OM, WA, MET, TI]; Pirate is current/daily only
const rules = {
  // now value (five sources) at t0
  B0: (r, g) => wavg(slotVals(r, g, 'w0'), weights(r, g)),
  M: (r, g) => median(slotVals(r, g, 'w0')),
  // hourly array (four sources) at t0 and t1
  B0h: (r, g, f = 'w0') => { const v = slotVals(r, g, f), w = weights(r, g); return wavg(HOURLY.map((i) => v[i]), HOURLY.map((i) => w[i])); },
  Mh: (r, g, f = 'w0') => { const v = slotVals(r, g, f); return median(HOURLY.map((i) => v[i])); },
};

// R table: per region × season × part, mean(obs)/mean(fc) on TRAIN; < 40 hours → region × part; → 1; clamp [0.4, 2.5]
function learnTable(train, fc, minN = 40, lo = 0.4, hi = 2.5) {
  const cell = new Map(), rp = new Map();
  for (const r of train) { const x = fc(r); if (!isNum(x) || !isNum(r.obsWind)) continue;
    for (const [map, key] of [[cell, `${r.region}|${r.season}|${r.part}`], [rp, `${r.region}|${r.part}`]]) { const a = map.get(key) || { o: 0, f: 0, n: 0 }; a.o += r.obsWind; a.f += x; a.n++; map.set(key, a); } }
  const regions = [...new Set(train.map((r) => r.region))];
  const out = {};
  for (const reg of regions) { out[reg] = {};
    for (const s of SEASONS) { out[reg][s] = {};
      for (const p of PARTS) { const a = cell.get(`${reg}|${s}|${p}`), b = rp.get(`${reg}|${p}`);
        out[reg][s][p] = a && a.n >= minN && a.f > 0 ? clamp(a.o / a.f, lo, hi) : b && b.n >= minN && b.f > 0 ? clamp(b.o / b.f, lo, hi) : 1; } } }
  return out;
}
// the production table: the three guesses' tables averaged cell by cell, then the display clamp [0.7, 1.6] (Fable 2)
const meanTables = (ts, lo = 0.7, hi = 1.6) => { const out = {}; for (const reg of Object.keys(ts[0])) { out[reg] = {}; for (const s of SEASONS) { out[reg][s] = {}; for (const p of PARTS) out[reg][s][p] = round(clamp(mean(ts.map((t) => t[reg]?.[s]?.[p] ?? 1)), lo, hi), 3); } } return out; };
const ratio = (T, r) => T[r.region]?.[r.season]?.[r.part] ?? 1;

// ---------- data ----------
const rows = SCORED.flatMap((st) => buildRows(st, loadObs(st.id)));
const train = rows.filter((r) => inRange(r.day, TRAIN)), test = rows.filter((r) => inRange(r.day, TEST));
console.log(`rows ${rows.length} · train ${train.length} · test ${test.length}`);
const regions = [...new Set(SCORED.map((s) => s.region))];

// ---------- §2 wind ----------
const tablesB = G.map((g) => learnTable(train, (r) => rules.B0(r, g)));
const tablesM = G.map((g) => learnTable(train, (r) => rules.M(r, g)));
const TB = meanTables(tablesB), TM = meanTables(tablesM);
const TBu = meanTables(tablesB, 0.4, 2.5), TMu = meanTables(tablesM, 0.4, 2.5);   // unclamped, for the 68911 cap test only
const STATIONS_OF = Object.fromEntries([...new Set(SCORED.map((s) => s.region))].map((reg) => [reg, SCORED.filter((s) => s.region === reg).map((s) => s.id)]));
const cand = {
  B0: { now: (r, g) => rules.B0(r, g), hour: (r, g, f) => rules.B0h(r, g, f) },
  M: { now: (r, g) => rules.M(r, g), hour: (r, g, f) => rules.Mh(r, g, f) },
  BC: { now: (r, g) => { const x = rules.B0(r, g); return isNum(x) ? x * ratio(TB, r) : null; }, hour: (r, g, f) => { const x = rules.B0h(r, g, f); return isNum(x) ? x * ratio(TB, r) : null; } },
  MC: { now: (r, g) => { const x = rules.M(r, g); return isNum(x) ? x * ratio(TM, r) : null; }, hour: (r, g, f) => { const x = rules.Mh(r, g, f); return isNum(x) ? x * ratio(TM, r) : null; } },
};
// skill weights (report only): per guess, per slot, 1/MSE per region × part on TRAIN; SWC on each slot corrected by its model's own table
const modelTables = Object.fromEntries(RUN_MODELS.map((mm) => [mm, learnTable(train, (r) => r.m[mm]?.w0)]));
function skill(g, corrected) {
  const slots = GUESSES[g], acc = new Map();
  const val = (r, i) => { const x = r.m[slots[i]]?.w0; return isNum(x) ? (corrected ? x * ratio(modelTables[slots[i]], r) : x) : null; };
  for (const r of train) for (let i = 0; i < 5; i++) { const x = val(r, i); if (!isNum(x) || !isNum(r.obsWind)) continue; const k = `${r.region}|${r.part}|${i}`; const a = acc.get(k) || { se: 0, n: 0 }; a.se += (x - r.obsWind) ** 2; a.n++; acc.set(k, a); }
  return (r) => { const v = [0, 1, 2, 3, 4].map((i) => val(r, i)); const w = v.map((_, i) => { const a = acc.get(`${r.region}|${r.part}|${i}`); return a && a.n >= 40 ? 1 / (a.se / a.n) : 0; }); return wavg(v, w); };
}
const SW = Object.fromEntries(G.map((g) => [g, { plain: skill(g, false), corr: skill(g, true) }]));

const windErr = (list, f) => list.map((r) => { const x = f(r); return isNum(x) && isNum(r.obsWind) ? { day: r.day, r, x, e: x - r.obsWind } : null; }).filter(Boolean);
const windSum = (e) => ({ n: e.length, mae: round(mean(e.map((x) => Math.abs(x.e))), 3), bias: round(mean(e.map((x) => x.e)), 3),
  windyHours: e.filter((x) => x.r.obsWind >= WINDY).length, caught25: e.filter((x) => x.r.obsWind >= WINDY && x.x >= 25).length, false25: e.filter((x) => x.r.obsWind < WINDY && x.x >= 25).length });
const pairBoot = (list, fa, fb) => bootDiff(list.map((r) => { const a = fa(r), b = fb(r); return isNum(a) && isNum(b) && isNum(r.obsWind) ? { day: r.day, a: Math.abs(a - r.obsWind), b: Math.abs(b - r.obsWind) } : null; }).filter(Boolean), 1000, 7, week);

const out = { plan: 'review/accuracy/v5/PLAN.md', train: TRAIN, test: TEST, tables: { B: TB, M: TM, perGuessB: tablesB, perGuessM: tablesM }, wind: {}, headline: {}, gust: {}, sky: {}, live: {}, strand: {} };
for (const g of G) {
  out.wind[g] = { t0: {}, t0hourly: {}, t1hourly: {}, boot: {}, byRegion: {} };
  for (const [n, c] of Object.entries(cand)) {
    out.wind[g].t0[n] = windSum(windErr(test, (r) => c.now(r, g)));
    out.wind[g].t0hourly[n] = windSum(windErr(test, (r) => c.hour(r, g, 'w0')));
    out.wind[g].t1hourly[n] = windSum(windErr(test.map((r) => ({ ...r })), (r) => c.hour(r, g, 'w1')));
    if (n !== 'B0') out.wind[g].boot[n] = { t0: pairBoot(test, (r) => c.now(r, g), (r) => cand.B0.now(r, g)), t1: pairBoot(test, (r) => c.hour(r, g, 'w1'), (r) => cand.B0.hour(r, g, 'w1')) };
  }
  out.wind[g].t0.SW = windSum(windErr(test, SW[g].plain));
  out.wind[g].t0.SWC = windSum(windErr(test, SW[g].corr));
  for (const reg of regions) {
    const L = test.filter((r) => r.region === reg);
    out.wind[g].byRegion[reg] = { stations: STATIONS_OF[reg], n: L.filter((r) => isNum(r.obsWind)).length, ...Object.fromEntries(['M', 'BC', 'MC'].map((n) => [n, { mae: windSum(windErr(L, (r) => cand[n].now(r, g))).mae, b0: windSum(windErr(L, (r) => cand.B0.now(r, g))).mae, boot: pairBoot(L, (r) => cand[n].now(r, g), (r) => cand.B0.now(r, g)) }])) };
  }
}

// ---------- §3 headline ----------
const gustG0 = (r, g) => { const v = GUST_GUESSES[g].map((mm) => r.gust[mm]).filter(isNum); return v.length ? Math.max(...v) : null; };
const truthWind = (r) => (isNum(r.obsWind) && r.obsWind >= WINDY) || (isNum(r.obsGust) && r.obsGust >= BIG_GUST);
// The full shipped wind rung (Fable 3): (number ≥ T or largest gust ≥ 55) AND the consensus — ≥ 2 of the five
// slots each at ≥ 0.8·T after the same correction, or a slot gust ≥ 44 (gusts: the [OM, WA, Pirate] slots).
const TABLE_OF = { M: null, BC: TB, MC: TM, B0: null };
function saidWind(r, g, n, T) {
  const x = cand[n].now(r, g), gust = gustG0(r, g);
  if (!((isNum(x) && x >= T) || (isNum(gust) && gust >= BIG_GUST))) return false;
  const k = TABLE_OF[n] ? ratio(TABLE_OF[n], r) : 1;
  const w = slotVals(r, g, 'w0'), gs = GUST_GUESSES[g].map((mm) => r.gust[mm]);
  let support = 0;
  for (let i = 0; i < 5; i++) if ((isNum(w[i]) && w[i] * k >= 0.8 * T) || (i < 3 && isNum(gs[i]) && gs[i] >= 0.8 * BIG_GUST)) support++;
  return support >= 2;
}
const hlList = (list, n, g, T) => list.filter((r) => isNum(r.obsWind)).map((r) => ({ week: r.week, region: r.region, t: truthWind(r), p: saidWind(r, g, n, T) }));
const Tpick = {};
for (const n of ['M', 'BC', 'MC']) {
  const score = T_GRID.map((T) => ({ T, f1: mean(G.map((g) => f1(hlList(train, n, g, T)))) }));
  Tpick[n] = [...score].sort((a, b) => b.f1 - a.f1 || a.T - b.T)[0].T;
  out.headline[n] = { T: Tpick[n], train: score };
}
const recall = (l, k) => { const t = l.filter((x) => x.t); return t.length ? t.filter((x) => x[k]).length / t.length : null; };
for (const g of G) for (const n of ['M', 'BC', 'MC']) {
  const both = test.filter((r) => isNum(r.obsWind)).map((r) => ({ week: r.week, region: r.region, t: truthWind(r), pNew: saidWind(r, g, n, Tpick[n]), pOld: saidWind(r, g, 'B0', 25) }));
  const fNew = (l) => f1(l.map((x) => ({ t: x.t, p: x.pNew }))), fOld = (l) => f1(l.map((x) => ({ t: x.t, p: x.pOld })));
  const pr = (l, k) => { const tp = l.filter((x) => x[k] && x.t).length, calm = l.filter((x) => !x.t); return { precision: round(tp / Math.max(1, l.filter((x) => x[k]).length), 3), recall: round(recall(l, k), 3), said: l.filter((x) => x[k]).length, falsePer100Calm: round((100 * calm.filter((x) => x[k]).length) / Math.max(1, calm.length), 2) }; };
  out.headline[n][g] = { f1New: round(fNew(both), 3), f1Old: round(fOld(both), 3), boot: bootStat(both, fNew, fOld), recallBoot: bootStat(both, (l) => recall(l, 'pNew'), (l) => recall(l, 'pOld')), newPR: pr(both, 'pNew'), oldPR: pr(both, 'pOld'), windyHours: both.filter((x) => x.t).length,
    flipsToWind: both.filter((x) => x.pNew && !x.pOld).length, flipsFromWind: both.filter((x) => !x.pNew && x.pOld).length,
    byRegion: Object.fromEntries(regions.map((reg) => { const L = both.filter((x) => x.region === reg); return [reg, { stations: STATIONS_OF[reg], n: L.length, windyHours: L.filter((x) => x.t).length, f1New: round(fNew(L), 3), f1Old: round(fOld(L), 3), newPR: pr(L, 'pNew'), oldPR: pr(L, 'pOld'), flipsToWind: L.filter((x) => x.pNew && !x.pOld).length, boot: bootStat(L, fNew, fOld) }]; })) };
}

// ---------- §4 gusts ----------
const gRules = { G0: (r, g) => gustG0(r, g), GM: (r, g) => median(GUST_GUESSES[g].map((mm) => r.gust[mm])) };
function learnGust(fc) { const acc = new Map(); for (const r of train) { if (!isNum(r.obsGust)) continue; const x = fc(r); if (!isNum(x)) continue; const a = acc.get(r.region) || { o: 0, f: 0, n: 0 }; a.o += r.obsGust; a.f += x; a.n++; acc.set(r.region, a); }
  return Object.fromEntries(regions.map((reg) => { const a = acc.get(reg); return [reg, a && a.n >= 30 && a.f > 0 ? clamp(a.o / a.f, 0.5, 2) : 1]; })); }
const avgGustTables = (ts) => Object.fromEntries(regions.map((reg) => [reg, round(mean(ts.map((t) => t[reg])), 3)]));
const RG0 = avgGustTables(G.map((g) => learnGust((r) => gRules.G0(r, g)))), RGM = avgGustTables(G.map((g) => learnGust((r) => gRules.GM(r, g))));
const gCand = { G0: gRules.G0, GM: gRules.GM, G0C: (r, g) => { const x = gRules.G0(r, g); return isNum(x) ? x * RG0[r.region] : null; }, GMC: (r, g) => { const x = gRules.GM(r, g); return isNum(x) ? x * RGM[r.region] : null; } };
out.gust.tables = { G0C: RG0, GMC: RGM };
for (const g of G) {
  const gg = test.filter((r) => isNum(r.obsGust));
  out.gust[g] = { boot: {}, bigF1: {}, byRegion: {} };
  for (const [n, f] of Object.entries(gCand)) {
    const e = gg.map((r) => { const x = f(r, g); return isNum(x) ? x - r.obsGust : null; }).filter(isNum);
    out.gust[g][n] = { n: e.length, mae: round(mean(e.map(Math.abs)), 3), bias: round(mean(e), 3) };
    const big = test.filter((r) => isNum(r.obsWind)).map((r) => ({ week: r.week, t: (isNum(r.obsGust) && r.obsGust >= BIG_GUST) || r.obsWind >= BIG_GUST, pN: isNum(f(r, g)) && f(r, g) >= BIG_GUST, pO: isNum(gCand.G0(r, g)) && gCand.G0(r, g) >= BIG_GUST }));
    out.gust[g].bigF1[n] = { f1: round(f1(big.map((x) => ({ t: x.t, p: x.pN }))), 3), boot: n === 'G0' ? null : bootStat(big, (l) => f1(l.map((x) => ({ t: x.t, p: x.pN }))), (l) => f1(l.map((x) => ({ t: x.t, p: x.pO })))),
      falseBigNoGroup: test.filter((r) => isNum(r.obsWind) && !isNum(r.obsGust) && isNum(f(r, g)) && f(r, g) >= BIG_GUST).length };
    if (n !== 'G0') {
      out.gust[g].boot[n] = bootDiff(gg.map((r) => { const a = f(r, g), b = gCand.G0(r, g); return isNum(a) && isNum(b) ? { day: r.day, a: Math.abs(a - r.obsGust), b: Math.abs(b - r.obsGust) } : null; }).filter(Boolean), 1000, 7, week);
      out.gust[g].byRegion[n] = Object.fromEntries(regions.map((reg) => [reg, bootDiff(gg.filter((r) => r.region === reg).map((r) => { const a = f(r, g), b = gCand.G0(r, g); return isNum(a) && isNum(b) ? { day: r.day, a: Math.abs(a - r.obsGust), b: Math.abs(b - r.obsGust) } : null; }).filter(Boolean), 1000, 7, week)]));
    }
  }
}

// ---------- §5 sky ----------
const skyRules = {
  S0: (r, g) => { const v = slotVals(r, g, 'cloud'), w = weights(r, g); const e = HOURLY.map((i) => ({ v: v[i], w: w[i] })).filter((x) => isNum(x.v)); return e.length ? pickModalCloud(e.map((x) => x.v), e.map((x) => x.w)) : null; },
  S4: (r, g) => { const v = slotVals(r, g, 'cloud'); return median(HOURLY.map((i) => v[i])); },
  S5: (r, g) => median(slotVals(r, g, 'cloud')),
};
for (const g of G) {
  const L = test.filter((r) => obsSky(r.obsCloud));
  out.sky[g] = { byRegion: {} };
  const rowsOf = (list, n) => list.map((r) => { const c = skyCat(skyRules[n](r, g)), t = obsSky(r.obsCloud); return c ? { day: r.day, r, c, t, ok: c === t ? 1 : 0 } : null; }).filter(Boolean);
  const sum = (l) => ({ n: l.length, right: round(mean(l.map((x) => x.ok)), 4), falseCloudy: round(l.filter((x) => x.c === 'cloudy' && x.t === 'clear').length / Math.max(1, l.length), 4), missedCloud: round(l.filter((x) => x.c === 'clear' && x.t === 'cloudy').length / Math.max(1, l.length), 4), saidCloudy: l.filter((x) => x.c === 'cloudy').length });
  // Fable 5: day hours (06–18 SAST) are the primary; all hours and the two-way (cloudy vs not) are reported
  const D = L.filter((r) => r.h >= 6 && r.h < 18);
  for (const n of Object.keys(skyRules)) { out.sky[g][n] = sum(rowsOf(D, n)); out.sky[g][`${n}all`] = sum(rowsOf(L, n));
    const two = rowsOf(D, n); out.sky[g][`${n}twoWay`] = round(mean(two.map((x) => ((x.c === 'cloudy') === (x.t === 'cloudy') ? 1 : 0))), 4); }
  const bootSky = (list, n) => bootDiff(list.map((r) => { const a = skyCat(skyRules[n](r, g)), b = skyCat(skyRules.S0(r, g)), t = obsSky(r.obsCloud); return a && b ? { day: r.day, a: a === t ? 1 : 0, b: b === t ? 1 : 0 } : null; }).filter(Boolean), 1000, 7, week);
  out.sky[g].boot = { S5: bootSky(D, 'S5'), S4: bootSky(D, 'S4'), S5all: bootSky(L, 'S5'), S4all: bootSky(L, 'S4') };
  for (const reg of regions) { const R = D.filter((r) => r.region === reg); out.sky[g].byRegion[reg] = { stations: STATIONS_OF[reg], n: R.length, S5: bootSky(R, 'S5'), S4: bootSky(R, 'S4'), right: { S0: sum(rowsOf(R, 'S0')).right, S5: sum(rowsOf(R, 'S5')).right, S4: sum(rowsOf(R, 'S4')).right } }; }
}

// ---------- live guard (real sources) ----------
const REGION_OF = Object.fromEntries(SCORED.map((s) => [s.id, s.region]));
const live = [];
if (existsSync(LIVE_DIR)) {
  for (const f of readdirSync(LIVE_DIR).filter((x) => x.endsWith('.jsonl'))) for (const line of readFileSync(path.join(LIVE_DIR, f), 'utf8').trim().split('\n')) {
    let x; try { x = JSON.parse(line); } catch { continue; }
    const p = x.api?.payload; if (!x.icao || !p?.meta?.sourceNow) continue;
    const at = Date.parse(p.meta.updatedAtLabel || x.runAtUtc); if (!isNum(at)) continue;
    const rep = (x.metar?.reports || []).map((m) => ({ m, d: Math.abs((m.obsTime ?? 0) * 1000 - at) })).filter((y) => y.d <= 40 * 60e3).sort((a, b) => a.d - b.d)[0]?.m;
    if (!rep || !isNum(rep.wspd)) continue;
    const sast = new Date(at + 2 * 3600e3), day = sast.toISOString().slice(0, 10), h = sast.getUTCHours();
    const src = Object.fromEntries(p.meta.sourceNow.map((s) => [s.name, s]));
    live.push({ key: `${x.icao}|${new Date(at).toISOString()}`, block: String(Math.floor(at / 86400e3)), /* 24-h blocks (Fable 1) */ region: REGION_OF[x.icao], season: SEASON(day), part: PART(h), obsWind: rep.wspd * 1.852, obsGust: isNum(rep.wgst) ? rep.wgst * 1.852 : null,
      served: p.now.windKph, med: median(['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'].map((n) => src[n]?.windKph)),
      g0: (() => { const v = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather'].map((n) => src[n]?.gustKph).filter(isNum); return v.length ? Math.max(...v) : null; })(),
      gm: median(['Open-Meteo', 'WeatherAPI', 'Pirate Weather'].map((n) => src[n]?.gustKph)) });
  }
}
const liveU = [...new Map(live.map((x) => [x.key, x])).values()];
const lv = { B0: (x) => x.served, M: (x) => x.med, BC: (x) => (isNum(x.served) ? x.served * ratio(TB, x) : null), MC: (x) => (isNum(x.med) ? x.med * ratio(TM, x) : null) };
out.live.n = liveU.length;
out.live.wind = Object.fromEntries(Object.entries(lv).map(([n, f]) => { const e = liveU.map((x) => (isNum(f(x)) ? f(x) - x.obsWind : null)).filter(isNum); return [n, { n: e.length, mae: round(mean(e.map(Math.abs)), 3), bias: round(mean(e), 3),
  boot: n === 'B0' ? null : bootDiff(liveU.map((x) => (isNum(f(x)) && isNum(x.served) ? { day: x.block, a: Math.abs(f(x) - x.obsWind), b: Math.abs(x.served - x.obsWind) } : null)).filter(Boolean), 1000, 7) }]; }));
// Fable 1: the sign rule — a region is blocked when its live base runs against its correction by more than 3 km/h
out.live.sign = {};
for (const [n, base, T] of [['BC', (x) => x.served, TB], ['MC', (x) => x.med, TM]]) {
  out.live.sign[n] = Object.fromEntries([...new Set(liveU.map((x) => x.region))].map((reg) => {
    const L = liveU.filter((x) => x.region === reg && isNum(base(x)));
    const bias = mean(L.map((x) => base(x) - x.obsWind)), rr = mean(L.map((x) => ratio(T, x)));
    return [reg, { n: L.length, liveBias: round(bias, 2), meanRatio: round(rr, 3), blocked: (rr > 1 && bias > 3) || (rr < 1 && bias < -3) }];
  }));
}
const lg = { G0: (x) => x.g0, GM: (x) => x.gm, G0C: (x) => (isNum(x.g0) ? x.g0 * RG0[x.region] : null), GMC: (x) => (isNum(x.gm) ? x.gm * RGM[x.region] : null) };
const liveG = liveU.filter((x) => isNum(x.obsGust));
out.live.gust = Object.fromEntries(Object.entries(lg).map(([n, f]) => { const e = liveG.map((x) => (isNum(f(x)) ? f(x) - x.obsGust : null)).filter(isNum); return [n, { n: e.length, mae: round(mean(e.map(Math.abs)), 3),
  boot: n === 'G0' ? null : bootDiff(liveG.map((x) => (isNum(f(x)) && isNum(x.g0) ? { day: x.block, a: Math.abs(f(x) - x.obsGust), b: Math.abs(x.g0 - x.obsGust) } : null)).filter(Boolean), 1000, 7) }]; }));

// ---------- §6 Strand 68911 ----------
function parseSynop68911() {
  const out = new Map();
  for (const f of readdirSync(DATA).filter((x) => /^synop-68911-\d{6}\.txt$/.test(x))) for (const line of readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
    const c = line.split(','); if (c[0] !== '68911' || c.length < 7) continue;
    const msg = c.slice(6).join(',').replace(/=\s*$/, '').trim(); if (/NIL/.test(msg)) continue;
    const g = msg.split(/\s+/); const iw = Number(g[1]?.slice(4, 5)); const wind = g[4]; if (!/^[\d/]\d{4}$/.test(wind ?? '')) continue;
    const dd = Number(wind.slice(1, 3)), ff = Number(wind.slice(3, 5)); if (!Number.isFinite(ff) || ff === 99) continue;
    const unit = iw === 3 || iw === 4 ? 1.852 : iw === 0 || iw === 1 ? 3.6 : null; if (!unit) continue;
    const i333 = g.indexOf('333'); const i555 = g.indexOf('555'); const sec3 = i333 >= 0 ? g.slice(i333 + 1, i555 > i333 ? i555 : undefined) : [];
    const gg = sec3.find((x) => /^910\d\d$/.test(x));
    const utc = Date.UTC(+c[1], +c[2] - 1, +c[3], +c[4]); const sast = new Date(utc + 2 * 3600e3);
    out.set(sast.toISOString().slice(0, 13), { windKph: ff * unit, dirDeg: dd * 10, gustKph: gg ? Number(gg.slice(3)) * unit : null });
  }
  return out;
}
const syn = parseSynop68911();
out.strand.reports = syn.size;
if (syn.size && existsSync(path.join(DATA, 'runs-68911-best_match.json'))) {
  const st = { id: '68911', region: 'Western Cape', lat: -34.1408, lon: 18.8483 };
  const sRows = buildRows(st, syn).filter((r) => isNum(r.obsWind));
  out.strand.byMonth = Object.fromEntries([...new Set(sRows.map((r) => r.day.slice(0, 7)))].map((mo) => [mo, sRows.filter((r) => r.day.startsWith(mo)).length]));
  const sTest = sRows.filter((r) => inRange(r.day, TEST));
  out.strand.transfer = Object.fromEntries(G.map((g) => [g, Object.fromEntries(Object.entries(cand).map(([n, c]) => [n, { ...windSum(windErr(sTest, (r) => c.now(r, g))), boot: n === 'B0' ? null : pairBoot(sTest, (r) => c.now(r, g), (r) => cand.B0.now(r, g)) }]))]));
  // Fable 2: does Strand support lifting Western Cape's clamp? unclamped vs clamped, same rule
  const unc = { BC: (r, g) => { const x = rules.B0(r, g); return isNum(x) ? x * ratio(TBu, r) : null; }, MC: (r, g) => { const x = rules.M(r, g); return isNum(x) ? x * ratio(TMu, r) : null; } };
  out.strand.capLift = Object.fromEntries(['BC', 'MC'].map((n) => [n, Object.fromEntries(G.map((g) => [g, { unclamped: windSum(windErr(sTest, (r) => unc[n](r, g))).mae, clamped: windSum(windErr(sTest, (r) => cand[n].now(r, g))).mae, boot: pairBoot(sTest, (r) => unc[n](r, g), (r) => cand[n].now(r, g)) }]))]));
  // south-easter: Open-Meteo's (best_match) bearing 90–180°; chronological halves of the usable reports
  const se = sRows.filter((r) => isNum(r.m.best_match?.dir) && r.m.best_match.dir >= 90 && r.m.best_match.dir <= 180).sort((a, b) => (a.day + a.h).localeCompare(b.day + b.h));
  const half = Math.floor(se.length / 2), A = se.slice(0, half), Bh = se.slice(half);
  const dA = new Set(A.map((r) => r.day)).size, dB = new Set(Bh.map((r) => r.day)).size;
  out.strand.southEaster = { reports: se.length, daysFirstHalf: dA, daysSecondHalf: dB, enough: dA >= 14 && dB >= 14, byGuess: {} };
  if (dA >= 14 && dB >= 14) for (const g of G) for (const n of ['B0', 'M', 'BC', 'MC']) {   // B0: the base where the rule is blocked at Strand
    const fa = (r) => cand[n].now(r, g); const o = mean(A.map((r) => r.obsWind)), fcm = mean(A.map(fa)); const k = isNum(fcm) && fcm > 0 ? clamp(o / fcm, 0.4, 2.5) : 1;
    out.strand.southEaster.byGuess[`${g}|${n}`] = { ratio: round(k, 3), boot: pairBoot(Bh, (r) => (isNum(fa(r)) ? fa(r) * k : null), fa), mae: round(mean(Bh.map((r) => Math.abs(fa(r) * k - r.obsWind))), 3), maeBefore: round(mean(Bh.map((r) => Math.abs(fa(r) - r.obsWind))), 3) };
  }
}

// ---------- decisions, exactly as PLAN §2–§5 ----------
const dec = { wind: {}, headline: {}, gust: {}, sky: {} };
for (const n of ['M', 'BC', 'MC']) {
  const t0ok = G.every((g) => clear95(out.wind[g].boot[n].t0, -1)), t1bad = G.some((g) => clear95(out.wind[g].boot[n].t1, +1)), liveBad = clear95(out.live.wind[n]?.boot, +1);
  dec.wind[n] = { passes: t0ok && !liveBad, t0ok, t1bad, liveBad, meanMae: round(mean(G.map((g) => out.wind[g].t0[n].mae)), 3), blocked: regions.filter((reg) => G.some((g) => clear95(out.wind[g].byRegion[reg][n].boot, +1))) };
}
for (const n of ['BC', 'MC']) dec.wind[n].liveSignBlocked = Object.entries(out.live.sign[n]).filter(([, v]) => v.blocked).map(([reg]) => reg);
const winners = Object.entries(dec.wind).filter(([, d]) => d.passes).sort((a, b) => a[1].meanMae - b[1].meanMae);
dec.wind.ship = winners[0]?.[0] ?? null;
if (dec.wind.ship) { const n = dec.wind.ship;
  const recallOk = G.every((g) => clear95(out.headline[n][g].recallBoot, +1)), f1Bad = G.some((g) => clear95(out.headline[n][g].boot, -1));
  dec.headline = { rule: n, T: Tpick[n], recallOk, f1Bad, ships: recallOk && !f1Bad };
  if (out.strand.transfer) dec.wind.strandBlocked = G.some((g) => clear95(out.strand.transfer[g][n].boot, +1));
  if (out.strand.capLift?.[n]) dec.wind.westernCapeUnclamped = G.every((g) => clear95(out.strand.capLift[n][g].boot, -1)); }
// PLAN §6: the south-easter ratio at Strand, on the base that applies there (today's blend where the rule is blocked)
if (out.strand.southEaster?.enough) { const base = dec.wind.ship && !dec.wind.strandBlocked ? dec.wind.ship : 'B0'; dec.strandSouthEaster = { base, ships: G.every((g) => clear95(out.strand.southEaster.byGuess[`${g}|${base}`]?.boot, -1)), ratios: Object.fromEntries(G.map((g) => [g, out.strand.southEaster.byGuess[`${g}|${base}`]?.ratio])) }; }
for (const n of ['GM', 'G0C', 'GMC']) {
  const maeOk = G.every((g) => clear95(out.gust[g].boot[n], -1)), f1bad = G.some((g) => clear95(out.gust[g].bigF1[n].boot, -1)), liveBad = clear95(out.live.gust[n]?.boot, +1);
  // Fable 4: the ratio rules are gated on the all-hours big-gust F1 (clearly better) and false big gusts on no-gust-group hours (not more than G0's)
  const f1ok = G.every((g) => clear95(out.gust[g].bigF1[n].boot, +1)), fewerFalse = G.every((g) => out.gust[g].bigF1[n].falseBigNoGroup <= out.gust[g].bigF1.G0.falseBigNoGroup);
  const passes = n === 'GM' ? maeOk && !f1bad && !liveBad : f1ok && fewerFalse && !liveBad;
  dec.gust[n] = { passes, maeOk, f1ok, f1bad, fewerFalse, liveBad, meanMae: round(mean(G.map((g) => out.gust[g][n].mae)), 3), meanF1: round(mean(G.map((g) => out.gust[g].bigF1[n].f1)), 3), blocked: regions.filter((reg) => G.some((g) => clear95(out.gust[g].byRegion[n][reg], +1))) };
}
dec.gust.ship = Object.entries(dec.gust).filter(([, d]) => d.passes).sort((a, b) => a[1].meanMae - b[1].meanMae)[0]?.[0] ?? null;
for (const n of ['S5', 'S4']) dec.sky[n] = { passes: G.every((g) => clear95(out.sky[g].boot[n], +1)), blocked: regions.filter((reg) => G.some((g) => clear95(out.sky[g].byRegion[reg][n], -1))) };
out.decisions = dec;

mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v5-score.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));

// ---------- summary ----------
const fb = (b) => (b && isNum(b.diff) ? `${b.diff.toFixed(2)} [${isNum(b.lo) ? b.lo.toFixed(2) : '?'}, ${isNum(b.hi) ? b.hi.toFixed(2) : '?'}]` : '—');
console.log('\n== WIND (MAE km/h, 2026, t0 now value / t1 hourly)');
for (const g of G) { console.log(`-- ${g}`); for (const n of ['B0', 'M', 'BC', 'MC', 'SW', 'SWC']) { const a = out.wind[g].t0[n], b = out.wind[g].t1hourly[n]; console.log(`  ${n.padEnd(4)} t0 ${a.mae} bias ${a.bias} windy ${a.caught25}/${a.windyHours} false ${a.false25}${b ? ` | t1h ${b.mae}` : ''}${out.wind[g].boot[n] ? ` | vs B0 t0 ${fb(out.wind[g].boot[n].t0)} t1 ${fb(out.wind[g].boot[n].t1)}` : ''}`); } }
console.log('live (real sources):', JSON.stringify(Object.fromEntries(Object.entries(out.live.wind).map(([n, v]) => [n, `${v.mae} ${fb(v.boot)}`]))), 'n', out.live.n);
console.log('\n== HEADLINE', JSON.stringify(Object.fromEntries(['M', 'BC', 'MC'].map((n) => [n, { T: Tpick[n], ...Object.fromEntries(G.map((g) => [g, `${out.headline[n][g].f1Old}→${out.headline[n][g].f1New} ${fb(out.headline[n][g].boot)} P ${out.headline[n][g].oldPR.precision}→${out.headline[n][g].newPR.precision} R ${out.headline[n][g].oldPR.recall}→${out.headline[n][g].newPR.recall}`])) }]))));
console.log('\n== GUSTS'); for (const g of G) console.log(`  ${g}: ${['G0', 'GM', 'G0C', 'GMC'].map((n) => `${n} ${out.gust[g][n].mae}${out.gust[g].boot[n] ? ` ${fb(out.gust[g].boot[n])}` : ''} F1 ${out.gust[g].bigF1[n].f1}`).join(' · ')}`);
console.log('  live:', JSON.stringify(Object.fromEntries(Object.entries(out.live.gust).map(([n, v]) => [n, `${v.mae} n${v.n} ${fb(v.boot)}`]))));
console.log('\n== SKY (share right)'); for (const g of G) console.log(`  ${g}: S0 ${out.sky[g].S0.right} S4 ${out.sky[g].S4.right} S5 ${out.sky[g].S5.right} | S5−S0 ${fb(out.sky[g].boot.S5)} S4−S0 ${fb(out.sky[g].boot.S4)} | false cloudy ${out.sky[g].S0.falseCloudy}→${out.sky[g].S5.falseCloudy} missed ${out.sky[g].S0.missedCloud}→${out.sky[g].S5.missedCloud}`);
console.log('\n== STRAND 68911 reports', out.strand.reports, JSON.stringify(out.strand.byMonth ?? {}));
if (out.strand.transfer) for (const g of G) console.log(`  ${g}: ${Object.entries(out.strand.transfer[g]).map(([n, v]) => `${n} ${v.mae} bias ${v.bias}${v.boot ? ` ${fb(v.boot)}` : ''}`).join(' · ')} (n ${out.strand.transfer[g].B0.n})`);
console.log('  south-easter', JSON.stringify(out.strand.southEaster ?? null).slice(0, 600));
console.log('\n== DECISIONS', JSON.stringify(dec, null, 1));
