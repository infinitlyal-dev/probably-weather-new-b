// FROST NIGHTS — the low on clear, calm, dry nights inland, on top of the low as shipped (bbb662a). Pre-registered
// in PLAN.md (with Fable's changes): inland = grid elevation ≥ 500 m, the Lowveld blocked (not tuned on, not
// applied); gate from the grid C × W × X on Open-Meteo's own forecast night; δ = the mean error of the as-shipped
// low on gated 2025 nights, leave-one-station-out, per lead, capped at 5 °C; the gate minimising the 2025 LOSO MAE;
// tested once on 2026 at the inland airports (δ learned without them) and the four SAWS towns (never used):
// all-night MAE and frost-night MAE (observed low ≤ 2 °C) co-primary, t1 and t0, three source assignments.
//   node review/accuracy/v3/frost.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RUN_MODELS } from '../v2/stations.mjs';
import { SYNOP_STATIONS } from '../v2/fetch-synop.mjs';
import { DATA, RESULTS, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, loadRuns, days, hourKey } from '../v2/lib.mjs';
import { buildRows, learn, consensus } from '../v2/tempcore.mjs';
import { appBlend, VARIANTS } from '../v2/temps-replay.mjs';
import { inLowveld } from '../../../api/_lib/precision.js';
import { loadPrev, gridElevation } from './lib3.mjs';

const A = 0.5;
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const prevDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10);

// ---- Open-Meteo's forecast night for a station-day at a lead (the gate's inputs) ----
function nightOf(runs, prev, d, lead) {
  const hrs = lead === 't1'
    ? [...[20, 21, 22, 23].map((h) => hourKey(prevDay(d), h)), ...[...Array(9).keys()].map((h) => hourKey(d, h))]
    : [...Array(9).keys()].map((h) => hourKey(d, h));
  const cloud = [], wind = [];
  for (const k of hrs) {
    const r = runs.get(k), p = prev?.get(k);
    cloud.push(lead === 't1' ? p?.cloud1 : r?.cloud); wind.push(lead === 't1' ? r?.w1 : r?.w0);
  }
  const k0 = hrs[0], r0 = runs.get(k0), p0 = prev?.get(k0);
  const temp = lead === 't1' ? r0?.t1 : r0?.t0, dew = lead === 't1' ? p0?.dew1 : r0?.dew;
  const c = cloud.filter(isNum), w = wind.filter(isNum);
  return { cloud: c.length >= 10 || (lead === 't0' && c.length >= 8) ? mean(c) : null, wind: w.length >= 8 ? mean(w) : null, depression: isNum(temp) && isNum(dew) ? temp - dew : null };
}

// ---- rows: inland airports (tempcore, the same station-days as the precision run) and the four towns ----
function airportRows(lead) {
  const { rows, stationsUsed } = buildRows(lead);
  const inland = stationsUsed.filter((s) => (gridElevation(s.id) ?? s.elev) >= 500 && !inLowveld(s.lat, s.lon));
  const ids = new Set(inland.map((s) => s.id));
  const cache = Object.fromEntries(inland.map((s) => [s.id, { runs: loadRuns(s.id, 'best_match'), prev: loadPrev(s.id) }]));
  return { stations: inland, rows: rows.filter((r) => ids.has(r.id) && isNum(r.obsMin)).map((r) => ({ ...r, night: nightOf(cache[r.id].runs, cache[r.id].prev, r.day, lead) })) };
}
function townRows(lead) {
  // SYNOP overnight minimum (06 UTC report, 333 2-group) — the same parse as v2/synop-check.mjs
  const mins = new Map();
  const groupT = (tok) => (/^[12][01]\d{3}$/.test(tok) ? (tok[1] === '1' ? -1 : 1) * Number(tok.slice(2)) / 10 : null);
  for (const f of readdirSync(DATA).filter((x) => /^synop-\d{3}-\d{6}\.txt$/.test(x))) {
    for (const line of readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
      const m = /^(\d{5}),(\d{4}),(\d{2}),(\d{2}),(\d{2}),(\d{2}),AAXX (.*)$/.exec(line.trim());
      if (!m || m[5] !== '06' || !SYNOP_STATIONS.some((s) => s.id === m[1])) continue;
      const sec3 = m[7].replace(/=+$/, '').split(/\s+333\s+/)[1]?.split(/\s+555\s+/)[0]?.split(/\s+/) || [];
      const tn = sec3.find((t) => t[0] === '2' && groupT(t) !== null);
      if (tn) mins.set(`${m[1]}|${m[2]}-${m[3]}-${m[4]}`, groupT(tn));
    }
  }
  const rows = [];
  for (const st of SYNOP_STATIONS) {
    const R = Object.fromEntries(RUN_MODELS.map((mdl) => [mdl, loadRuns(st.id, mdl)]));
    const prev = loadPrev(st.id);
    for (const d of days('2025-01-02', '2026-09-24')) {
      const obsMin = mins.get(`${st.id}|${d}`); if (!isNum(obsMin)) continue;
      const fc = {};
      for (const [mdl, runs] of Object.entries(R)) {
        const v = (day, h) => runs.get(hourKey(day, h))?.[lead];
        const lo = []; for (let h = 20; h <= 23; h++) lo.push(v(prevDay(d), h)); for (let h = 0; h <= 8; h++) lo.push(v(d, h));
        const all = []; for (let h = 0; h < 24; h++) all.push(v(d, h));
        const ok = (a) => a.filter(isNum);
        fc[mdl] = { min: ok(lo).length ? Math.min(...ok(lo)) : null, max: ok(all.slice(8, 21)).length ? Math.max(...ok(all.slice(8, 21))) : null,
          dayHigh: ok(all.slice(7, 19)).length ? Math.max(...ok(all.slice(7, 19))) : null, fromNowMax: ok(all.slice(6)).length ? Math.max(...ok(all.slice(6))) : null, fromNowMin: ok(all.slice(6)).length ? Math.min(...ok(all.slice(6))) : null };
      }
      rows.push({ id: st.id, region: st.region, lat: st.lat, lon: st.lon, day: d, season: SEASON(d), obsMin, fc, night: nightOf(R.best_match, prev, d, lead) });
    }
  }
  return rows;
}

const GRID = []; for (const C of [10, 20, 30, 40]) for (const W of [6, 8, 10, 12]) for (const X of [0, 4, 6, 8]) GRID.push({ C, W, X });
const gated = (g) => (r) => isNum(r.night.cloud) && r.night.cloud <= g.C && isNum(r.night.wind) && r.night.wind <= g.W && isNum(r.night.depression) && r.night.depression >= g.X;

const out = { leads: {}, gate: null };
const byLead = {};
for (const lead of ['t1', 't0']) {
  const { stations, rows } = airportRows(lead);
  const towns = townRows(lead);
  // the SA table learned on 2025 at every airport (towns) and without each station (airports), as v2/temps.mjs
  const all = buildRows(lead).rows;
  const tr = all.filter((r) => inRange(r.day, TRAIN));
  const saLoso = Object.fromEntries(stations.map((s) => [s.id, learn(tr.filter((r) => r.id !== s.id), 'min')]));
  const sa = learn(tr, 'min');
  const shipped = (vn) => (r, table) => { const a = appBlend(r.fc, VARIANTS[vn], r.lat, r.lon, lead).min, c = consensus(r, 'min', table); return isNum(a) && isNum(c) ? (1 - A) * a + A * c : a; };
  for (const r of rows) r.base = Object.fromEntries(Object.keys(VARIANTS).map((vn) => [vn, shipped(vn)(r, saLoso[r.id])]));
  for (const r of towns) r.base = Object.fromEntries(Object.keys(VARIANTS).map((vn) => [vn, shipped(vn)(r, sa)]));
  byLead[lead] = { stations, rows, towns };
}

// ---- the gate: min 2025 LOSO MAE over all nights at the inland airports, mean over leads and assignments ----
const deltaFor = (list, g) => { const e = list.filter(gated(g)).flatMap((r) => Object.values(r.base).map((b, i) => (isNum(b) ? b - r.obsMin : null))).filter(isNum); return e.length ? Math.max(0, Math.min(5, mean(e))) : 0; };
const correct = (r, vn, g, delta) => (gated(g)(r) && isNum(r.base[vn]) ? r.base[vn] - delta : r.base[vn]);
let best = null;
for (const g of GRID) {
  const maes = [];
  for (const lead of ['t1', 't0']) {
    const { stations, rows } = byLead[lead]; const tr = rows.filter((r) => inRange(r.day, TRAIN));
    for (const s of stations) {
      const own = tr.filter((r) => r.id === s.id), delta = deltaFor(tr.filter((r) => r.id !== s.id), g);
      for (const vn of Object.keys(VARIANTS)) for (const r of own) { const x = correct(r, vn, g, delta); if (isNum(x)) maes.push(Math.abs(x - r.obsMin)); }
    }
  }
  const m = mean(maes); if (!best || m < best.mae) best = { ...g, mae: m };
}
out.gate = best;

// ---- test on 2026 ----
const pairs = (list, fa, fb, key = 'obsMin') => list.map((r) => { const a = fa(r), b = fb(r); return isNum(a) && isNum(b) ? { day: r.day, a: Math.abs(a - r[key]), b: Math.abs(b - r[key]) } : null; }).filter(Boolean);
for (const lead of ['t1', 't0']) {
  const { stations, rows, towns } = byLead[lead];
  const tr = rows.filter((r) => inRange(r.day, TRAIN)), te = rows.filter((r) => inRange(r.day, TEST)), town = towns.filter((r) => inRange(r.day, TEST));
  const deltaLoso = Object.fromEntries(stations.map((s) => [s.id, deltaFor(tr.filter((r) => r.id !== s.id), best)]));
  const deltaAll = deltaFor(tr, best);
  const res = { deltaAll, deltaLoso, airports: {}, towns: {}, byStation: {}, gatedShare: {} };
  for (const vn of Object.keys(VARIANTS)) {
    const fixA = (r) => correct(r, vn, best, deltaLoso[r.id]), base = (r) => r.base[vn], fixT = (r) => correct(r, vn, best, deltaAll);
    const frostA = te.filter((r) => r.obsMin <= 2), frostT = town.filter((r) => r.obsMin <= 2);
    const sc = (list, f) => { const e = list.map((r) => { const x = f(r); return isNum(x) ? x - r.obsMin : null; }).filter(isNum); return { n: e.length, mae: mean(e.map(Math.abs)), bias: mean(e) }; };
    res.airports[vn] = { all: bootDiff(pairs(te, fixA, base), 1000, 7, week), frost: bootDiff(pairs(frostA, fixA, base), 1000, 7, week), before: sc(te, base), after: sc(te, fixA), frostBefore: sc(frostA, base), frostAfter: sc(frostA, fixA) };
    res.towns[vn] = { all: bootDiff(pairs(town, fixT, base), 1000, 7, week), frost: bootDiff(pairs(frostT, fixT, base), 1000, 7, week), before: sc(town, base), after: sc(town, fixT), frostBefore: sc(frostT, base), frostAfter: sc(frostT, fixT) };
    for (const s of [...stations.map((x) => x.id), ...SYNOP_STATIONS.map((x) => x.id)]) {
      const l = [...te, ...town].filter((r) => r.id === s), f = stations.some((x) => x.id === s) ? fixA : fixT;
      (res.byStation[s] ||= {})[vn] = { before: sc(l, base), after: sc(l, f), diff: bootDiff(pairs(l, f, base), 1000, 7, week) };
    }
  }
  res.gatedShare = { airports: te.filter(gated(best)).length / te.length, towns: town.filter(gated(best)).length / town.length };
  res.ships = Object.keys(VARIANTS).every((vn) => ['all', 'frost'].every((k) => res.airports[vn][k]?.hi < 0 && res.towns[vn][k]?.hi < 0));
  out.leads[lead] = res;
}
out.ships = out.leads.t1.ships && out.leads.t0.ships;
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v3-frost.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));

const f2 = (x) => (isNum(x) ? x.toFixed(2) : '—');
const ci = (b) => (b ? `${f2(b.diff)} [${f2(b.lo)}, ${f2(b.hi)}]` : '—');
console.log(`FROST — gate: cloud ≤ ${best.C}%, wind ≤ ${best.W} km/h, depression ≥ ${best.X} °C (2025 LOSO MAE ${f2(best.mae)})`);
for (const [lead, r] of Object.entries(out.leads)) {
  console.log(`\n== ${lead}: δ (all airports) ${f2(r.deltaAll)} °C; gated share 2026: airports ${(r.gatedShare.airports * 100).toFixed(0)}%, towns ${(r.gatedShare.towns * 100).toFixed(0)}%`);
  for (const vn of Object.keys(VARIANTS)) {
    const a = r.airports[vn], t = r.towns[vn];
    console.log(`  ${vn.padEnd(12)} airports all ${f2(a.before.mae)}→${f2(a.after.mae)} ${ci(a.all)} · frost ${f2(a.frostBefore.mae)}→${f2(a.frostAfter.mae)} (bias ${f2(a.frostBefore.bias)}→${f2(a.frostAfter.bias)}, n ${a.frostBefore.n}) ${ci(a.frost)}`);
    console.log(`  ${''.padEnd(12)} towns    all ${f2(t.before.mae)}→${f2(t.after.mae)} ${ci(t.all)} · frost ${f2(t.frostBefore.mae)}→${f2(t.frostAfter.mae)} (bias ${f2(t.frostBefore.bias)}→${f2(t.frostAfter.bias)}, n ${t.frostBefore.n}) ${ci(t.frost)}`);
  }
  console.log(`  ships at ${lead}: ${r.ships}`);
  console.log('  by station (old harness):', Object.entries(r.byStation).map(([s, v]) => `${s} ${f2(v['old harness'].before.mae)}→${f2(v['old harness'].after.mae)}${v['old harness'].diff?.lo > 0 ? ' WORSE' : ''}`).join(' · '));
}
console.log(`\nSHIPS: ${out.ships}`);
