// WIND GETS ITS OWN WEIGHTS — scored exactly as review/accuracy/v6/PLAN.md says (with §4a, Fable's ten changes), once.
//   node review/accuracy/v6/score6.mjs        → v2/results/v6-score.json + a printed summary
// Live: the recorder's six airports (real five sources' own now-wind vs METAR), tune = first half of each airport's
// readings in time, prove = second half. Strand: its readings vs SAWS 68911 (never tuned on). Archive: 16 airports,
// 2025 tune, 2026 prove, three source guesses (v5's machinery, copied so this file runs on its own).
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SCORED, RUN_MODELS } from '../v2/stations.mjs';
import { loadObs, loadHist, days, hourKey, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, DATA, RESULTS } from '../v2/lib.mjs';
import { productionWeights, VARIANTS } from '../v2/temps-replay.mjs';
import { shapeWind, windLine } from '../../../api/_lib/wind.js';
import { WIND_TABLE } from '../../../api/_lib/wind-table.js';

const LIVE_DIR = process.env.PW_LIVE_DIR || 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const SRC = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];
const H4 = [0, 1, 3, 4];                                   // the hourly sources: OM, WA, MET, TI
const G = Object.keys(VARIANTS);
const PART = (h) => (h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
const PARTS = ['night', 'morning', 'afternoon', 'evening'], SEASONS = ['DJF', 'MAM', 'JJA', 'SON'];
const T_WINDY = WIND_TABLE.headline.thresholdKph, BIG_GUST = 55;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const wavg = (vals, w) => { let s = 0, ws = 0; vals.forEach((v, i) => { if (isNum(v) && w[i] > 0) { s += v * w[i]; ws += w[i]; } }); return ws ? s / ws : null; };
const clear95 = (b, sign) => (b && isNum(b.lo) && isNum(b.hi) ? (sign < 0 ? b.hi < 0 : b.lo > 0) : false);
const REGION_OF = Object.fromEntries(SCORED.map((s) => [s.id, s.region]));
const LIVE_REGIONS = { FACT: 'Western Cape', FAOR: 'Highveld', FALE: 'KZN coast', FAPE: 'Eastern Cape', FABL: 'Free State', FAGG: 'Garden Route' };
const COORD = { FACT: [-33.9648, 18.6017], FAOR: [-26.1392, 28.246], FALE: [-29.6144, 31.1197], FAPE: [-33.9849, 25.6173], FABL: [-29.0927, 26.3024], FAGG: [-34.0056, 22.3789] };
const STRAND = { lat: -34.1163, lon: 18.8362 };
const sastOf = (ms) => { const d = new Date(ms + 2 * 3600e3); return { day: d.toISOString().slice(0, 10), h: d.getUTCHours(), month: d.getUTCMonth() + 1 }; };
const out = { plan: 'review/accuracy/v6/PLAN.md', live: {}, strand: {}, archive: {}, decisions: {} };

// =====================================================================================================================
// LIVE
// =====================================================================================================================
const recs = [];
for (const f of readdirSync(LIVE_DIR).filter((x) => x.endsWith('.jsonl')).sort()) for (const line of readFileSync(path.join(LIVE_DIR, f), 'utf8').trim().split('\n')) {
  let x; try { x = JSON.parse(line); } catch { continue; }
  const p = x.api?.payload; if (!p?.meta?.sourceNow) continue;
  const at = Date.parse(p.meta.updatedAtLabel || x.runAtUtc); if (!isNum(at)) continue;
  recs.push({ x, p, at });
}
const lastReading = recs.reduce((m, r) => Math.max(m, Date.parse(r.x.runAtUtc)), 0);
out.live.window = { from: new Date(Math.min(...recs.map((r) => r.at))).toISOString(), to: new Date(lastReading).toISOString() };

function srcVals(p) { const by = Object.fromEntries(p.meta.sourceNow.map((s) => [s.name, s])); return { w: SRC.map((n) => (isNum(by[n]?.windKph) ? by[n].windKph : null)), g: SRC.map((n) => (isNum(by[n]?.gustKph) ? by[n].gustKph : null)) }; }
const rawOf = (p) => (isNum(p.meta.wind?.rawKph) ? p.meta.wind.rawKph : p.now.windKph);   // before acd15b2 now.windKph was the raw blend
const hourlyWOf = (p) => { const w = SRC.map((n) => p.meta.sourceWeights?.[n] ?? null); return H4.map((i) => w[i]); };   // production's own (rounded %) weights

const airport = [];
{
  const seen = new Set();
  for (const { x, p, at } of recs) {
    if (!x.icao || !LIVE_REGIONS[x.icao]) continue;
    const key = `${x.icao}|${new Date(at).toISOString()}`; if (seen.has(key)) continue;
    const rep = (x.metar?.reports || []).map((m) => ({ m, d: Math.abs((m.obsTime ?? 0) * 1000 - at) })).filter((y) => y.d <= 40 * 60e3).sort((a, b) => a.d - b.d)[0]?.m;
    if (!rep || !isNum(rep.wspd)) continue;
    seen.add(key);
    const s = sastOf(at), { w, g } = srcVals(p), [lat, lon] = COORD[x.icao];
    const bc = shapeWind({ raw: rawOf(p), values: w, lat, lon, month: s.month, hour: s.h });
    const h4w = hourlyWOf(p);
    const bc4raw = wavg(H4.map((i) => w[i]), h4w);
    airport.push({ icao: x.icao, region: LIVE_REGIONS[x.icao], at, day: s.day, h: s.h, part: PART(s.h), block6: `${x.icao}|${Math.floor(at / 6 / 3600e3)}`, blockDay: `${x.icao}|${s.day}`,
      obs: rep.wspd * 1.852, obsGust: isNum(rep.wgst) ? rep.wgst * 1.852 : null, w, g, n: w.filter(isNum).length,
      BC: bc.kph, bcRatio: bc.ratio, BC4: isNum(bc4raw) ? bc4raw * bc.ratio : null });
  }
}
airport.sort((a, b) => a.at - b.at);
const byIcao = Object.fromEntries(Object.keys(LIVE_REGIONS).map((id) => [id, airport.filter((r) => r.icao === id)]));
for (const id of Object.keys(byIcao)) { const L = byIcao[id], half = Math.floor(L.length / 2); L.forEach((r, i) => { r.half = i < half ? 'tune' : 'prove'; }); }
out.live.n = Object.fromEntries(Object.entries(byIcao).map(([id, L]) => [id, { all: L.length, tune: L.filter((r) => r.half === 'tune').length, prove: L.filter((r) => r.half === 'prove').length, split: L[Math.floor(L.length / 2)] ? new Date(L[Math.floor(L.length / 2)].at).toISOString() : null }]));

// ---- LW: per region, weights ∝ 1/MSE (tune), normalised, clamped [0.05, 0.50], renormalised (Fable 2); k on all-five tune hours
function learnLW(tune) {
  const mse = SRC.map((_, i) => { const e = tune.filter((r) => isNum(r.w[i])).map((r) => (r.w[i] - r.obs) ** 2); return e.length >= 12 ? { mse: mean(e), n: e.length } : { mse: null, n: e.length }; });
  let w = mse.map((m) => (isNum(m.mse) && m.mse > 0 ? 1 / m.mse : 0)); const s0 = w.reduce((a, b) => a + b, 0); w = w.map((x) => (s0 ? x / s0 : 0));
  w = w.map((x) => (x > 0 ? clamp(x, 0.05, 0.5) : 0)); const s1 = w.reduce((a, b) => a + b, 0); w = w.map((x) => (s1 ? x / s1 : 0));
  const kOf = (idx) => { const full = tune.filter((r) => idx.every((i) => isNum(r.w[i]))); const o = mean(full.map((r) => r.obs)), f = mean(full.map((r) => wavg(idx.map((i) => r.w[i]), idx.map((i) => w[i])))); return !isNum(o) || o < 10 || !isNum(f) || f <= 0 ? { k: 1, meanObs: o, n: full.length } : { k: clamp(o / f, 0.7, 1.6), meanObs: o, n: full.length }; };
  return { mse: mse.map((m) => ({ mse: round(m.mse, 2), n: m.n })), weights: w.map((x) => round(x, 4)), k: kOf([0, 1, 2, 3, 4]), k4: kOf(H4) };
}
const LW = {};
for (const [id, reg] of Object.entries(LIVE_REGIONS)) LW[reg] = learnLW(byIcao[id].filter((r) => r.half === 'tune'));
const lwOf = (r, reg = r.region) => { const m = LW[reg]; const b = wavg(r.w, m.weights); return isNum(b) ? b * m.k.k : null; };
const lw4Of = (r, reg = r.region) => { const m = LW[reg]; const b = wavg(H4.map((i) => r.w[i]), H4.map((i) => m.weights[i])); return isNum(b) ? b * m.k4.k : null; };
out.live.LW = LW;

const mae = (L, f) => mean(L.map((r) => (isNum(f(r)) ? Math.abs(f(r) - r.obs) : null)));
const bias = (L, f) => mean(L.map((r) => (isNum(f(r)) ? f(r) - r.obs : null)));
const boot = (L, fa, fb, blockKey) => bootDiff(L.map((r) => { const a = fa(r), b = fb(r); return isNum(a) && isNum(b) ? { day: r[blockKey], a: Math.abs(a - r.obs), b: Math.abs(b - r.obs) } : null; }).filter(Boolean), 1000, 7);
const prove = airport.filter((r) => r.half === 'prove');

// pooled (interval, blocks = airport × SAST day)
out.live.pooled = { LW: { mae: round(mae(prove, lwOf), 3), bc: round(mae(prove, (r) => r.BC), 3), boot: boot(prove, lwOf, (r) => r.BC, 'blockDay') },
  LW4: { mae: round(mae(prove, lw4Of), 3), bc4: round(mae(prove, (r) => r.BC4), 3), boot: boot(prove, lw4Of, (r) => r.BC4, 'blockDay') } };
// per region: the minimum-evidence rule (Fable 1)
function minEvidence(L, fa, fb) {
  const d = mae(L, fa) - mae(L, fb);
  const blocks = [...new Set(L.map((r) => r.block6))].map((k) => { const B = L.filter((r) => r.block6 === k); return mae(B, fa) - mae(B, fb); }).filter(isNum);
  const better = blocks.filter((x) => x < 0).length, worse = blocks.filter((x) => x > 0).length;
  const full5 = L.filter((r) => r.n === 5).length;
  return { diff: round(d, 3), blocks: blocks.length, better, worse, full5, ships: d <= -1.0 && better >= 4 && full5 >= 24, blocked: d >= 1.0 || worse > blocks.length / 2 };
}
out.live.region = {};
for (const [id, reg] of Object.entries(LIVE_REGIONS)) {
  const L = prove.filter((r) => r.icao === id);
  out.live.region[reg] = { airport: id, n: L.length, maeBC: round(mae(L, (r) => r.BC), 3), maeLW: round(mae(L, lwOf), 3), biasBC: round(bias(L, (r) => r.BC), 2), biasLW: round(bias(L, lwOf), 2),
    perSource: SRC.map((n, i) => ({ source: n, mae: round(mae(L, (r) => r.w[i]), 2), bias: round(bias(L, (r) => r.w[i]), 2) })),
    LW: minEvidence(L, lwOf, (r) => r.BC), LW4: { diff: round(mae(L, lw4Of) - mae(L, (r) => r.BC4), 3) } };
}
// missing sources (Fable 3)
{
  const few = prove.filter((r) => r.n < 5);
  out.live.missing = { hours: few.length, maeLW: round(mae(few, lwOf), 3), maeBC: round(mae(few, (r) => r.BC), 3) };
  out.live.missing.fallback = few.length > 0 && isNum(out.live.missing.maeLW) && out.live.missing.maeLW - out.live.missing.maeBC > 2;
}
// Windy (plan 1.4 + Fable 7): the rung — number ≥ T or largest gust ≥ 55, and ≥ 2 sources at ≥ 0.8·T × factor or gust ≥ 44
function saidWindy(r, kph, factor, T) {
  const gmax = Math.max(...r.g.filter(isNum), -1);
  if (!((isNum(kph) && kph >= T) || gmax >= BIG_GUST)) return false;
  let support = 0; for (let i = 0; i < 5; i++) if ((isNum(r.w[i]) && r.w[i] * factor >= 0.8 * T) || (isNum(r.g[i]) && r.g[i] >= 0.8 * BIG_GUST)) support++;
  return support >= 2;
}
const truthWindy = (r) => r.obs >= 30 || (isNum(r.obsGust) && r.obsGust >= BIG_GUST);
const calm = (r) => r.obs < 22 && !(isNum(r.obsGust) && r.obsGust >= 44);
out.live.windy = {};
for (const [id, reg] of Object.entries(LIVE_REGIONS)) {
  const L = prove.filter((r) => r.icao === id);
  const bcSaid = (r) => saidWindy(r, r.BC, r.bcRatio, T_WINDY), lwSaid = (r) => saidWindy(r, lwOf(r), LW[reg].k.k, T_WINDY);
  const f = { windyHours: L.filter(truthWindy).length, calmHours: L.filter(calm).length, nearLine: L.filter((r) => !truthWindy(r) && !calm(r)).length,
    caughtBC: L.filter((r) => truthWindy(r) && bcSaid(r)).length, caughtLW: L.filter((r) => truthWindy(r) && lwSaid(r)).length,
    falseBC: L.filter((r) => calm(r) && bcSaid(r)).length, falseLW: L.filter((r) => calm(r) && lwSaid(r)).length };
  f.blocksLW = f.falseLW > 2 * f.falseBC && f.falseLW - f.falseBC >= 3;
  out.live.windy[reg] = f;
}
// LG: gusts (≥ 20 gust-group hours in each half, else report only)
{
  const GI = [0, 1, 2];
  const tuneG = airport.filter((r) => r.half === 'tune' && isNum(r.obsGust)), proveG = prove.filter((r) => isNum(r.obsGust));
  out.live.gust = { tuneHours: tuneG.length, proveHours: proveG.length, enough: tuneG.length >= 20 && proveG.length >= 20 };
  const g0 = (r) => { const v = GI.map((i) => r.g[i]).filter(isNum); return v.length ? Math.max(...v) : null; };
  if (out.live.gust.enough) {
    const w = GI.map((i) => { const e = tuneG.filter((r) => isNum(r.g[i])).map((r) => (r.g[i] - r.obsGust) ** 2); return e.length ? 1 / mean(e) : 0; });
    const lg = (r) => wavg(GI.map((i) => r.g[i]), w);
    const P = proveG.map((r) => ({ ...r, obs: r.obsGust }));
    out.live.gust.weights = w.map((x) => round(x / w.reduce((a, b) => a + b, 0), 3));
    out.live.gust.maeLG = round(mae(P, lg), 2); out.live.gust.maeG0 = round(mae(P, g0), 2); out.live.gust.boot = boot(P, lg, g0, 'blockDay');
  }
}

// ---- Strand: its readings vs 68911 (never tuned on; Fable 6)
function parseSynop(text, into) {
  for (const line of text.split('\n')) {
    const c = line.trim().split(','); if (c[0] !== '68911' || c.length < 7) continue;
    const msg = c.slice(6).join(',').replace(/=\s*$/, '').trim(); if (/NIL/.test(msg)) continue;
    const g = msg.split(/\s+/); const iw = Number(g[1]?.slice(4, 5)); const wind = g[4]; if (!/^[\d/]\d{4}$/.test(wind ?? '')) continue;
    const dd = Number(wind.slice(1, 3)), ff = Number(wind.slice(3, 5)); if (!Number.isFinite(ff) || ff === 99) continue;
    const unit = iw === 3 || iw === 4 ? 1.852 : iw === 0 || iw === 1 ? 3.6 : null; if (!unit) continue;
    const i333 = g.indexOf('333'), i555 = g.indexOf('555'); const sec3 = i333 >= 0 ? g.slice(i333 + 1, i555 > i333 ? i555 : undefined) : [];
    const gg = sec3.find((x) => /^910\d\d$/.test(x));
    const utc = Date.UTC(+c[1], +c[2] - 1, +c[3], +c[4]);
    into.set(utc, { utc, windKph: ff * unit, dirDeg: dd * 10, gustKph: gg ? Number(gg.slice(3)) * unit : null });
  }
}
const syn = new Map();
for (const f of readdirSync(DATA).filter((x) => /^synop-68911-\d{6}\.txt$/.test(x))) parseSynop(readFileSync(path.join(DATA, f), 'utf8'), syn);
for (const { x } of recs) if (x.spot === 'Strand' && x.synop?.reports) parseSynop(x.synop.reports.join('\n'), syn);
const SEEN_PAIR = Date.UTC(2026, 8, 28, 6);
const strandRows = [];
{
  const reads = recs.filter((r) => r.x.spot === 'Strand');
  for (const [utc, s] of syn) {
    if (utc === SEEN_PAIR) continue;
    const rd = reads.map((r) => ({ r, d: Date.parse(r.x.runAtUtc) - utc })).filter((y) => y.d >= 0 && y.d <= 70 * 60e3).sort((a, b) => a.d - b.d)[0]?.r;
    if (!rd) continue;
    const { w } = srcVals(rd.p), at = rd.at, st = sastOf(at);
    strandRows.push({ utc: new Date(utc).toISOString(), day: st.day, obs: s.windKph, dir: s.dirDeg, gust: s.gustKph, w, today: rawOf(rd.p), served: rd.p.now.windKph, n: w.filter(isNum).length });
  }
}
strandRows.sort((a, b) => a.utc.localeCompare(b.utc));
{
  const lwS = (r) => lwOf(r, 'Western Cape');
  const pairs = strandRows.filter((r) => isNum(lwS(r)) && isNum(r.today));
  const better = pairs.filter((r) => Math.abs(lwS(r) - r.obs) < Math.abs(r.today - r.obs)).length, worse = pairs.filter((r) => Math.abs(lwS(r) - r.obs) > Math.abs(r.today - r.obs)).length;
  const dm = mae(pairs, lwS) - mae(pairs, (r) => r.today);
  out.strand.live = { reports: pairs.length, from: pairs[0]?.utc, to: pairs.at(-1)?.utc, maeToday: round(mae(pairs, (r) => r.today), 2), maeLW: round(mae(pairs, lwS), 2), biasToday: round(bias(pairs, (r) => r.today), 2), biasLW: round(bias(pairs, lwS), 2),
    better, worse, diff: round(dm, 2), passes: pairs.length > 0 && better >= 0.75 * pairs.length && dm <= -2, blocks: worse > pairs.length / 2,
    perSource: SRC.map((n, i) => ({ source: n, mae: round(mae(pairs, (r) => r.w[i]), 2), bias: round(bias(pairs, (r) => r.w[i]), 2) })),
    rows: pairs.map((r) => ({ utc: r.utc, station: round(r.obs, 1), dir: r.dir, gust: isNum(r.gust) ? round(r.gust, 1) : null, today: r.today, LW: round(lwS(r), 1), sources: r.w })) };
  // Strand's own weights — report only (first half learns, second half scores)
  const half = Math.floor(pairs.length / 2), own = learnLW(pairs.slice(0, half)), P2 = pairs.slice(half);
  out.strand.ownWeightsReportOnly = { learnedOn: half, scoredOn: P2.length, weights: own.weights, k: own.k.k, mae: round(mae(P2, (r) => { const b = wavg(r.w, own.weights); return isNum(b) ? b * own.k.k : null; }), 2), maeToday: round(mae(P2, (r) => r.today), 2) };
  // south-easter, live (report): station bearing 90–180°
  const se = pairs.filter((r) => r.dir >= 90 && r.dir <= 180);
  out.strand.southEasterLive = { reports: se.length, stationMean: round(mean(se.map((r) => r.obs)), 1), todayMean: round(mean(se.map((r) => r.today)), 1), perSource: SRC.map((n, i) => ({ source: n, mean: round(mean(se.map((r) => r.w[i])), 1) })) };
}

// =====================================================================================================================
// ARCHIVE (AW; AG report only)
// =====================================================================================================================
function loadRuns5(id, model) {
  const file = path.join(DATA, `runs-${id}-${model}.json`); if (!existsSync(file)) return null;
  const h = JSON.parse(readFileSync(file, 'utf8')).hourly; const m = new Map();
  for (let i = 0; i < h.time.length; i++) m.set(h.time[i].slice(0, 13), { t0: h.temperature_2m[i], w0: h.wind_speed_10m[i], w1: h.wind_speed_10m_previous_day1[i], dir: h.wind_direction_10m?.[i] ?? null });
  return m;
}
function dayMax(runs, day) { let m = null; for (let h = 0; h < 24; h++) { const v = runs.get(hourKey(day, h))?.t0; if (isNum(v)) m = m === null ? v : Math.max(m, v); } return m; }
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
function buildRows(st, obsMap) {
  const runs = Object.fromEntries(RUN_MODELS.map((m) => [m, loadRuns5(st.id, m)])); if (RUN_MODELS.some((m) => !runs[m])) return [];
  const hist = Object.fromEntries(['best_match', 'ecmwf_ifs025', 'gfs_seamless'].map((m) => [m, loadHist(st.id, m)]));
  const rows = [];
  for (const d of days('2025-01-01', '2026-09-24')) {
    const highs = Object.fromEntries(RUN_MODELS.map((m) => [m, dayMax(runs[m], d)]));
    for (let h = 0; h < 24; h++) { const k = hourKey(d, h), o = obsMap.get(k); if (!o) continue;
      rows.push({ id: st.id, region: st.region, lat: st.lat, lon: st.lon, day: d, h, week: week(d), season: SEASON(d), part: PART(h), obs: o.windKph, obsGust: o.gustKph, highs,
        m: Object.fromEntries(RUN_MODELS.map((mm) => [mm, runs[mm].get(k) || {}])), gust: Object.fromEntries(Object.entries(hist).map(([mm, H]) => [mm, H?.get(k)?.gust ?? null])) }); }
  }
  return rows;
}
const rows = SCORED.flatMap((st) => buildRows(st, loadObs(st.id))).filter((r) => isNum(r.obs));
const train = rows.filter((r) => inRange(r.day, TRAIN)), test = rows.filter((r) => inRange(r.day, TEST));
const regions = [...new Set(SCORED.map((s) => s.region))].filter((reg) => rows.some((r) => r.region === reg));
const slotVals = (r, g, f) => VARIANTS[g].map((mm) => r.m[mm]?.[f]);
const prodW = (r, g) => { const s = VARIANTS[g]; return productionWeights(s.map((m) => r.highs[m]), r.lat, r.lon).W; };
const tableRatio = (r) => WIND_TABLE.ratios[r.region]?.[r.season]?.[r.part] ?? 1;
const BC = (r, g, f = 'w0', idx = [0, 1, 2, 3, 4]) => { const v = slotVals(r, g, f), w = prodW(r, g); const b = wavg(idx.map((i) => v[i]), idx.map((i) => w[i])); return isNum(b) ? b * tableRatio(r) : null; };
// AW weights: per guess, per region × part, per slot ∝ 1/MSE on 2025 (cell n ≥ 40, else region; else equal), normalised; averaged over guesses
const AWW = {};
for (const reg of regions) { AWW[reg] = {};
  for (const p of PARTS) {
    const perG = G.map((g) => { const cell = train.filter((r) => r.region === reg && r.part === p), pool = cell.length >= 40 ? cell : train.filter((r) => r.region === reg);
      const w = [0, 1, 2, 3, 4].map((i) => { const e = pool.map((r) => { const x = slotVals(r, g, 'w0')[i]; return isNum(x) ? (x - r.obs) ** 2 : null; }).filter(isNum); return e.length >= 40 ? 1 / mean(e) : 0; });
      const s = w.reduce((a, b) => a + b, 0); return s ? w.map((x) => x / s) : [0.2, 0.2, 0.2, 0.2, 0.2]; });
    AWW[reg][p] = [0, 1, 2, 3, 4].map((i) => round(mean(perG.map((w) => w[i])), 4));
  } }
const awRaw = (r, g, f = 'w0', idx = [0, 1, 2, 3, 4]) => { const v = slotVals(r, g, f), w = AWW[r.region][r.part]; return wavg(idx.map((i) => v[i]), idx.map((i) => w[i])); };
function learnTable(list, fc) {
  const cell = new Map(), rp = new Map();
  for (const r of list) { const x = fc(r); if (!isNum(x)) continue; for (const [map, key] of [[cell, `${r.region}|${r.season}|${r.part}`], [rp, `${r.region}|${r.part}`]]) { const a = map.get(key) || { o: 0, f: 0, n: 0 }; a.o += r.obs; a.f += x; a.n++; map.set(key, a); } }
  const t = {}; for (const reg of regions) { t[reg] = {}; for (const s of SEASONS) { t[reg][s] = {}; for (const p of PARTS) { const a = cell.get(`${reg}|${s}|${p}`), b = rp.get(`${reg}|${p}`); t[reg][s][p] = a && a.n >= 40 && a.f > 0 ? clamp(a.o / a.f, 0.4, 2.5) : b && b.n >= 40 && b.f > 0 ? clamp(b.o / b.f, 0.4, 2.5) : 1; } } }
  return t;
}
const AWT = (() => { const ts = G.map((g) => learnTable(train, (r) => awRaw(r, g))); const t = {}; for (const reg of regions) { t[reg] = {}; for (const s of SEASONS) { t[reg][s] = {}; for (const p of PARTS) t[reg][s][p] = round(clamp(mean(ts.map((x) => x[reg][s][p])), 0.7, 1.6), 3); } } return t; })();
const AW = (r, g, f = 'w0', idx) => { const b = awRaw(r, g, f, idx); return isNum(b) ? b * (AWT[r.region]?.[r.season]?.[r.part] ?? 1) : null; };
const aBoot = (L, fa, fb) => bootDiff(L.map((r) => { const a = fa(r), b = fb(r); return isNum(a) && isNum(b) ? { day: r.day, a: Math.abs(a - r.obs), b: Math.abs(b - r.obs) } : null; }).filter(Boolean), 1000, 7, week);
out.archive.weights = AWW; out.archive.table = AWT; out.archive.byRegion = {};
for (const reg of regions) {
  const L = test.filter((r) => r.region === reg);
  const perG = Object.fromEntries(G.map((g) => [g, { maeBC: round(mae(L, (r) => BC(r, g)), 3), maeAW: round(mae(L, (r) => AW(r, g)), 3), t0: aBoot(L, (r) => AW(r, g), (r) => BC(r, g)),
    t1: aBoot(L, (r) => AW(r, g, 'w1', H4), (r) => BC(r, g, 'w1', H4)) }]));
  const passes = G.every((g) => clear95(perG[g].t0, -1) && perG[g].t0.diff <= -0.5), worse = G.some((g) => clear95(perG[g].t0, +1)), t1bad = G.some((g) => clear95(perG[g].t1, +1));
  out.archive.byRegion[reg] = { stations: SCORED.filter((s) => s.region === reg).map((s) => s.id), n: L.length, perGuess: perG, passes, worse, t1bad, live: Object.values(LIVE_REGIONS).includes(reg) };
}
// AW at 68911 (2026) vs today's blend there
{
  const st = { id: '68911', region: 'Western Cape', lat: -34.1408, lon: 18.8483 };
  const sMap = new Map([...syn.values()].map((s) => { const d = new Date(s.utc + 2 * 3600e3); return [d.toISOString().slice(0, 13), { windKph: s.windKph, gustKph: s.gustKph }]; }));
  const sRows = buildRows(st, sMap).filter((r) => isNum(r.obs) && inRange(r.day, TEST));
  const B0 = (r, g) => wavg(slotVals(r, g, 'w0'), prodW(r, g));
  out.archive.strand = Object.fromEntries(G.map((g) => [g, { n: sRows.length, maeToday: round(mae(sRows, (r) => B0(r, g)), 3), maeAW: round(mae(sRows, (r) => AW(r, g)), 3), boot: aBoot(sRows, (r) => AW(r, g), (r) => B0(r, g)) }]));
  // south-easter report (plan §2): station vs today's blend on 2026 reports with Open-Meteo's bearing 90–180°
  const se = sRows.filter((r) => isNum(r.m.best_match?.dir) && r.m.best_match.dir >= 90 && r.m.best_match.dir <= 180);
  out.strand.southEasterArchive = { reports: se.length, days: new Set(se.map((r) => r.day)).size, stationMean: round(mean(se.map((r) => r.obs)), 1), todayMean: Object.fromEntries(G.map((g) => [g, round(mean(se.map((r) => B0(r, g))), 1)])) };
}
// AG — report only (Fable 5)
{
  const GG = { 'old harness': ['best_match', 'ecmwf_ifs025', 'gfs_seamless'], 'ECMWF-heavy': ['best_match', 'ecmwf_ifs025', 'ecmwf_ifs025'], mixed: ['best_match', 'best_match', 'gfs_seamless'] };
  out.archive.gustReportOnly = Object.fromEntries(G.map((g) => {
    const tr = train.filter((r) => isNum(r.obsGust)), te = test.filter((r) => isNum(r.obsGust));
    const w = Object.fromEntries(regions.map((reg) => { const L = tr.filter((r) => r.region === reg); const v = [0, 1, 2].map((i) => { const e = L.map((r) => (isNum(r.gust[GG[g][i]]) ? (r.gust[GG[g][i]] - r.obsGust) ** 2 : null)).filter(isNum); return e.length >= 30 ? 1 / mean(e) : 0; }); return [reg, v]; }));
    const ag = (r) => wavg([0, 1, 2].map((i) => r.gust[GG[g][i]]), w[r.region]), g0 = (r) => { const v = [0, 1, 2].map((i) => r.gust[GG[g][i]]).filter(isNum); return v.length ? Math.max(...v) : null; };
    const T = te.map((r) => ({ ...r, obs: r.obsGust }));
    return [g, { n: T.length, maeAG: round(mae(T, ag), 2), maeG0: round(mae(T, g0), 2), boot: aBoot(T, ag, g0) }];
  }));
}

// =====================================================================================================================
// DECISIONS (PLAN §1.3–1.6 with §4a)
// =====================================================================================================================
const dec = { pooledLW: clear95(out.live.pooled.LW.boot, -1), pooledLW4ok: !clear95(out.live.pooled.LW4.boot, +1), regions: {} };
for (const reg of regions) {
  const live = out.live.region[reg], arch = out.archive.byRegion[reg], windy = out.live.windy[reg];
  let rule = 'BC', why = [];
  if (live) {
    if (dec.pooledLW && live.LW.ships && !windy.blocksLW) { rule = 'LW'; why.push('live minimum-evidence rule met'); }
    else {
      why.push(!dec.pooledLW ? 'pooled live gate not met' : live.LW.blocked ? 'LW worse here' : windy.blocksLW ? 'false Windy doubled' : 'LW not clearly better here');
      if (arch?.passes && !arch.t1bad) {
        const L = prove.filter((r) => r.region === reg);
        const awLive = (r) => { const b = wavg(r.w, AWW[reg][r.part]); return isNum(b) ? b * (AWT[reg]?.[SEASON(r.day)]?.[r.part] ?? 1) : null; };
        const me = minEvidence(L, awLive, (r) => r.BC); live.AWguard = me;
        if (!me.blocked) { rule = 'AW'; why.push('AW passed the archive; not worse live'); } else why.push('AW passed the archive but is worse live');
      }
    }
  } else if (arch?.passes && !arch.worse) { rule = arch.t1bad ? 'AW-now' : 'AW'; why.push('AW passed the archive (no live airport)'); }
  else why.push(arch ? (arch.worse ? 'AW worse in the archive' : 'AW not clearly better by ≥ 0.5') : 'no data');
  dec.regions[reg] = { rule, why: why.join('; ') };
}
dec.hourlyFollowsLW = dec.pooledLW4ok;
dec.strandZone = (() => {
  const wc = dec.regions['Western Cape']?.rule;
  if (wc === 'LW') return out.strand.live.passes ? 'LW' : 'today';
  if (wc === 'AW') return G.some((g) => clear95(out.archive.strand[g].boot, +1)) ? 'today' : 'AW';
  return 'today';
})();
dec.missingFallback = out.live.missing.fallback;
dec.gusts = out.live.gust.enough && clear95(out.live.gust.boot, -1) ? 'LG (check per region)' : 'unchanged (largest of three)';
out.decisions = dec;

writeFileSync(path.join(RESULTS, 'v6-score.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));

// ---------- summary ----------
const fb = (b) => (b && isNum(b.diff) ? `${b.diff.toFixed(2)} [${isNum(b.lo) ? b.lo.toFixed(2) : '?'}, ${isNum(b.hi) ? b.hi.toFixed(2) : '?'}]` : '—');
console.log('LIVE window', out.live.window, 'readings', JSON.stringify(out.live.n));
for (const [reg, m] of Object.entries(LW)) console.log(`  LW ${reg}: weights ${SRC.map((n, i) => `${n.split(' ')[0]} ${m.weights[i]}`).join(' · ')} | k ${round(m.k.k, 3)} (n ${m.k.n}) k4 ${round(m.k4.k, 3)}`);
console.log('POOLED prove: LW', out.live.pooled.LW.mae, 'vs BC', out.live.pooled.LW.bc, fb(out.live.pooled.LW.boot), '| LW4', out.live.pooled.LW4.mae, 'vs BC4', out.live.pooled.LW4.bc4, fb(out.live.pooled.LW4.boot));
for (const [reg, v] of Object.entries(out.live.region)) console.log(`  ${reg} (${v.airport}, n ${v.n}): BC ${v.maeBC} (bias ${v.biasBC}) → LW ${v.maeLW} (bias ${v.biasLW}) | ${JSON.stringify(v.LW)} | windy ${JSON.stringify(out.live.windy[reg])}`);
console.log('MISSING', JSON.stringify(out.live.missing), 'GUST', JSON.stringify(out.live.gust));
console.log('STRAND live', JSON.stringify({ ...out.strand.live, rows: undefined, perSource: undefined }), '\n  per source', JSON.stringify(out.strand.live.perSource), '\n  own weights (report)', JSON.stringify(out.strand.ownWeightsReportOnly), '\n  SE live', JSON.stringify(out.strand.southEasterLive), '\n  SE archive', JSON.stringify(out.strand.southEasterArchive));
console.log('ARCHIVE AW'); for (const [reg, v] of Object.entries(out.archive.byRegion)) console.log(`  ${reg}: ${G.map((g) => `${v.perGuess[g].maeBC}→${v.perGuess[g].maeAW} ${fb(v.perGuess[g].t0)}`).join(' | ')} passes ${v.passes} worse ${v.worse} t1bad ${v.t1bad}`);
console.log('  AW at 68911', JSON.stringify(Object.fromEntries(G.map((g) => [g, `${out.archive.strand[g].maeToday}→${out.archive.strand[g].maeAW} ${fb(out.archive.strand[g].boot)}`]))));
console.log('  AG (report)', JSON.stringify(Object.fromEntries(G.map((g) => [g, `${out.archive.gustReportOnly[g].maeG0}→${out.archive.gustReportOnly[g].maeAG} ${fb(out.archive.gustReportOnly[g].boot)}`]))));
console.log('\nDECISIONS', JSON.stringify(dec, null, 1));
