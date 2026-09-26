// FROST NIGHTS, a new attempt (review/accuracy/v4/PLAN.md §4, pre-registered c639248 + Fable fd3f2ed). On the low as
// production computes it now (blend mixed with the corrected consensus; the inland table in its regions, all-SA
// elsewhere; tables learned on 2025 leave-one-station-out), on nights Open-Meteo forecasts clear (mean cloud ≤ C) and
// calm (mean wind ≤ W), the low is lowered by δ:
//   dry    δ = k × D   (D: the forecast dew-point depression at the night's start)
//   spread δ = k × max(0, base − the coldest of the five models' own night minimum)
// k ≥ 0 by least squares through zero on gated 2025 nights at the other inland airports (leave-one-station-out),
// pooled over the three source assignments, per lead; δ ≤ 5 °C. (form, C, W) = the lowest 2025 LOSO MAE over all
// nights, mean over leads and assignments. A region worse on 2025 (point, any assignment, either lead) is blocked
// before the test. Test 2026 (7-day blocks), the rule as it would ship: all-nights and frost-night (observed low ≤
// 2 °C) MAE, whole interval below zero at t1 and t0 under all three assignments, pooled over the inland airports and
// over the four SAWS towns (never used in tuning); then a region wholly worse on 2026 is blocked too.
//   node review/accuracy/v4/frost.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RUN_MODELS } from '../v2/stations.mjs';
import { SYNOP_STATIONS } from '../v2/fetch-synop.mjs';
import { DATA, RESULTS, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, loadRuns, days, hourKey } from '../v2/lib.mjs';
import { CONS, buildRows, learn, consensus } from '../v2/tempcore.mjs';
import { appBlend, VARIANTS } from '../v2/temps-replay.mjs';
import { inLowveld } from '../../../api/_lib/precision.js';
import { PRECISION_TABLE_INLAND } from '../../../api/_lib/precision-table.js';
import { loadPrev, gridElevation } from '../v3/lib3.mjs';

const A = 0.5;
const INLAND_TABLE_REGIONS = new Set(PRECISION_TABLE_INLAND.regions);
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const prevDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10);

// Open-Meteo's forecast night (as v3): t1 = 20:00 the evening before → 08:00; t0 = 00:00 → 08:00
function nightOf(runs, prev, d, lead) {
  const hrs = lead === 't1'
    ? [...[20, 21, 22, 23].map((h) => hourKey(prevDay(d), h)), ...[...Array(9).keys()].map((h) => hourKey(d, h))]
    : [...Array(9).keys()].map((h) => hourKey(d, h));
  const cloud = [], wind = [];
  for (const k of hrs) { const r = runs.get(k), p = prev?.get(k); cloud.push(lead === 't1' ? p?.cloud1 : r?.cloud); wind.push(lead === 't1' ? r?.w1 : r?.w0); }
  const r0 = runs.get(hrs[0]), p0 = prev?.get(hrs[0]);
  const temp = lead === 't1' ? r0?.t1 : r0?.t0, dew = lead === 't1' ? p0?.dew1 : r0?.dew;
  const c = cloud.filter(isNum), w = wind.filter(isNum);
  return { cloud: c.length >= 10 || (lead === 't0' && c.length >= 8) ? mean(c) : null, wind: w.length >= 8 ? mean(w) : null, depression: isNum(temp) && isNum(dew) ? temp - dew : null };
}
function townRows(lead) {
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
    for (const d of days('2025-01-02', TEST.to)) {
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
const coldest = (r) => { const v = CONS.map((m) => r.fc[m]?.min).filter(isNum); return v.length === CONS.length ? Math.min(...v) : null; };

// ---- rows and the base (the low as production computes it now) ----
const byLead = {};
for (const lead of ['t1', 't0']) {
  const { rows, stationsUsed } = buildRows(lead);
  const stations = stationsUsed.filter((s) => (gridElevation(s.id) ?? s.elev) >= 500 && !inLowveld(s.lat, s.lon));
  const ids = new Set(stations.map((s) => s.id));
  const cache = Object.fromEntries(stations.map((s) => [s.id, { runs: loadRuns(s.id, 'best_match'), prev: loadPrev(s.id) }]));
  const air = rows.filter((r) => ids.has(r.id) && isNum(r.obsMin)).map((r) => ({ ...r, night: nightOf(cache[r.id].runs, cache[r.id].prev, r.day, lead) }));
  const towns = townRows(lead);
  const tr = rows.filter((r) => inRange(r.day, TRAIN));
  // 2025 tables, leave-one-station-out at the airports; the towns use the tables learned on every airport (as v3)
  const saT = Object.fromEntries(stations.map((s) => [s.id, learn(tr.filter((r) => r.id !== s.id), 'min')])); saT.TOWN = learn(tr, 'min');
  const inT = Object.fromEntries(stations.map((s) => [s.id, learn(tr.filter((r) => ids.has(r.id) && r.id !== s.id), 'min')])); inT.TOWN = learn(tr.filter((r) => ids.has(r.id)), 'min');
  const baseOf = (r, key) => Object.fromEntries(Object.keys(VARIANTS).map((vn) => {
    const table = (INLAND_TABLE_REGIONS.has(r.region) ? inT : saT)[key];
    const a = appBlend(r.fc, VARIANTS[vn], r.lat, r.lon, lead).min, c = consensus(r, 'min', table);
    return [vn, isNum(a) && isNum(c) ? (1 - A) * a + A * c : a];
  }));
  for (const r of air) { r.base = baseOf(r, r.id); r.cold = coldest(r); }
  for (const r of towns) { r.base = baseOf(r, 'TOWN'); r.cold = coldest(r); }
  byLead[lead] = { stations, air, towns };
}

// ---- the candidate ----
const GRID = [];
for (const form of ['dry', 'spread']) for (const C of [10, 20, 30, 40]) for (const W of [6, 8, 10, 12]) GRID.push({ form, C, W });
const gated = (g) => (r) => isNum(r.night.cloud) && r.night.cloud <= g.C && isNum(r.night.wind) && r.night.wind <= g.W;
const driver = (g, r, vn) => (g.form === 'dry' ? (isNum(r.night.depression) ? Math.max(0, r.night.depression) : null)
  : isNum(r.cold) && isNum(r.base[vn]) ? Math.max(0, r.base[vn] - r.cold) : null);
function fitK(list, g) {   // least squares through zero of (base − obs) on the driver, gated nights, all three assignments
  let sxy = 0, sxx = 0;
  for (const r of list) if (gated(g)(r)) for (const vn of Object.keys(VARIANTS)) { const x = driver(g, r, vn), b = r.base[vn]; if (isNum(x) && isNum(b)) { sxy += x * (b - r.obsMin); sxx += x * x; } }
  return sxx > 0 ? Math.max(0, sxy / sxx) : 0;
}
const corrected = (g, k, blocked) => (vn) => (r) => {
  const b = r.base[vn];
  if (!isNum(b) || blocked.has(r.region) || !gated(g)(r)) return b;
  const x = driver(g, r, vn);
  return isNum(x) ? b - Math.min(5, k * x) : b;
};
const maeOf = (list, f) => mean(list.map((r) => { const x = f(r); return isNum(x) ? Math.abs(x - r.obsMin) : null; }));

// ---- tune on 2025, leave-one-station-out ----
let best = null;
const NONE = new Set();
for (const g of GRID) {
  const maes = [];
  for (const lead of ['t1', 't0']) {
    const { stations, air } = byLead[lead]; const tr = air.filter((r) => inRange(r.day, TRAIN));
    for (const s of stations) {
      const own = tr.filter((r) => r.id === s.id), k = fitK(tr.filter((r) => r.id !== s.id), g);
      for (const vn of Object.keys(VARIANTS)) maes.push(maeOf(own, corrected(g, k, NONE)(vn)));
    }
  }
  const m = mean(maes); if (!best || m < best.mae) best = { ...g, mae: m };
}
// ---- the 2025 region guard (point estimates, any assignment, either lead) ----
const trainBlocked = new Set();
const trainGuard = {};
for (const lead of ['t1', 't0']) {
  const { stations, air } = byLead[lead]; const tr = air.filter((r) => inRange(r.day, TRAIN));
  const kLoso = Object.fromEntries(stations.map((s) => [s.id, fitK(tr.filter((r) => r.id !== s.id), best)]));
  for (const g of [...new Set(tr.map((r) => r.region))]) for (const vn of Object.keys(VARIANTS)) {
    const l = tr.filter((r) => r.region === g);
    const d = mean(l.map((r) => { const x = corrected(best, kLoso[r.id], NONE)(vn)(r), b = r.base[vn]; return isNum(x) && isNum(b) ? Math.abs(x - r.obsMin) - Math.abs(b - r.obsMin) : null; }));
    (trainGuard[g] ||= {})[`${lead} ${vn}`] = d;
    if (isNum(d) && d > 0) trainBlocked.add(g);
  }
}

// ---- test on 2026, the rule as it would ship ----
const pairs = (list, fa, fb) => list.map((r) => { const a = fa(r), b = fb(r); return isNum(a) && isNum(b) ? { day: r.day, a: Math.abs(a - r.obsMin), b: Math.abs(b - r.obsMin) } : null; }).filter(Boolean);
const out = { chosen: best, trainBlocked: [...trainBlocked], trainGuard, leads: {} };
const testBlocked = new Set();
for (const lead of ['t1', 't0']) {
  const { stations, air, towns } = byLead[lead];
  const tr = air.filter((r) => inRange(r.day, TRAIN)), te = air.filter((r) => inRange(r.day, TEST)), town = towns.filter((r) => inRange(r.day, TEST));
  const kLoso = Object.fromEntries(stations.map((s) => [s.id, fitK(tr.filter((r) => r.id !== s.id), best)]));
  const kAll = fitK(tr, best);
  const res = { kAll, kLoso, airports: {}, towns: {}, byRegion: {}, gatedShare: { airports: te.filter(gated(best)).length / te.length, towns: town.filter(gated(best)).length / town.length } };
  for (const vn of Object.keys(VARIANTS)) {
    const base = (r) => r.base[vn];
    const fixA = (r) => corrected(best, kLoso[r.id], trainBlocked)(vn)(r), fixT = (r) => corrected(best, kAll, trainBlocked)(vn)(r);
    const frostA = te.filter((r) => r.obsMin <= 2), frostT = town.filter((r) => r.obsMin <= 2);
    const sc = (list, f) => { const e = list.map((r) => { const x = f(r); return isNum(x) ? x - r.obsMin : null; }).filter(isNum); return { n: e.length, mae: mean(e.map(Math.abs)), bias: mean(e) }; };
    res.airports[vn] = { all: bootDiff(pairs(te, fixA, base), 1000, 7, week), frost: bootDiff(pairs(frostA, fixA, base), 1000, 7, week), before: sc(te, base), after: sc(te, fixA), frostBefore: sc(frostA, base), frostAfter: sc(frostA, fixA) };
    res.towns[vn] = { all: bootDiff(pairs(town, fixT, base), 1000, 7, week), frost: bootDiff(pairs(frostT, fixT, base), 1000, 7, week), before: sc(town, base), after: sc(town, fixT), frostBefore: sc(frostT, base), frostAfter: sc(frostT, fixT) };
    for (const g of [...new Set([...te, ...town].map((r) => r.region))]) {
      const l = [...te, ...town].filter((r) => r.region === g);
      const f = (r) => (stations.some((s) => s.id === r.id) ? fixA(r) : fixT(r));
      const d = bootDiff(pairs(l, f, base), 1000, 7, week);
      (res.byRegion[g] ||= {})[vn] = { before: sc(l, base), after: sc(l, f), diff: d };
      if (d && isNum(d.lo) && d.lo > 0) testBlocked.add(g);
    }
  }
  res.ships = Object.keys(VARIANTS).every((vn) => ['all', 'frost'].every((k) => res.airports[vn][k]?.hi < 0 && res.towns[vn][k]?.hi < 0));
  out.leads[lead] = res;
}
out.ships = out.leads.t1.ships && out.leads.t0.ships;
out.testBlocked = [...testBlocked];
out.shipsIn = out.ships ? [...new Set([...byLead.t1.air, ...byLead.t1.towns].map((r) => r.region))].filter((g) => !trainBlocked.has(g) && !testBlocked.has(g)) : [];
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v4-frost.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));

const f2 = (x) => (isNum(x) ? x.toFixed(2) : '—');
const ci = (b) => (b ? `${f2(b.diff)} [${f2(b.lo)}, ${f2(b.hi)}]` : '—');
console.log(`FROST v4 — chosen: ${best.form}, cloud ≤ ${best.C}%, wind ≤ ${best.W} km/h (2025 LOSO MAE ${f2(best.mae)}); blocked on 2025: ${[...trainBlocked].join(', ') || 'none'}`);
for (const [g, v] of Object.entries(trainGuard)) console.log(`  2025 guard ${g.padEnd(14)} ${Object.entries(v).map(([k, d]) => `${k} ${f2(d)}`).join(' · ')}`);
for (const [lead, r] of Object.entries(out.leads)) {
  console.log(`\n== ${lead}: k (all airports) ${f2(r.kAll)}; gated share 2026: airports ${(r.gatedShare.airports * 100).toFixed(0)}%, towns ${(r.gatedShare.towns * 100).toFixed(0)}%`);
  for (const vn of Object.keys(VARIANTS)) {
    const a = r.airports[vn], t = r.towns[vn];
    console.log(`  ${vn.padEnd(12)} airports all ${f2(a.before.mae)}→${f2(a.after.mae)} ${ci(a.all)} · frost ${f2(a.frostBefore.mae)}→${f2(a.frostAfter.mae)} (bias ${f2(a.frostBefore.bias)}→${f2(a.frostAfter.bias)}, n ${a.frostBefore.n}) ${ci(a.frost)}`);
    console.log(`  ${''.padEnd(12)} towns    all ${f2(t.before.mae)}→${f2(t.after.mae)} ${ci(t.all)} · frost ${f2(t.frostBefore.mae)}→${f2(t.frostAfter.mae)} (bias ${f2(t.frostBefore.bias)}→${f2(t.frostAfter.bias)}, n ${t.frostBefore.n}) ${ci(t.frost)}`);
  }
  for (const [g, m] of Object.entries(r.byRegion)) console.log(`  ${g.padEnd(14)} ${Object.entries(m).map(([vn, x]) => `${vn}: ${f2(x.before.mae)}→${f2(x.after.mae)}${x.diff?.lo > 0 ? ' WORSE' : x.diff?.hi < 0 ? ' better' : ''}`).join(' · ')}`);
  console.log(`  ships at ${lead}: ${r.ships}`);
}
console.log(`\nSHIPS: ${out.ships}${out.ships ? ` — in ${out.shipsIn.join(', ')}; blocked ${[...trainBlocked, ...testBlocked].join(', ') || 'none'}` : ''}`);
