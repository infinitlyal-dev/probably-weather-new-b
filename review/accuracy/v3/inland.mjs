// ICON INLAND — the precision run's lead ("inland, ICON alone did as well as the blend"). Pre-registered in
// PLAN.md (with Fable's change 8): both sides learned on 2025 only, leave-one-station-out — the 2025 all-SA
// table vs a 2025 table learned on the inland airports only; inland = grid elevation ≥ 500 m, the Lowveld still
// blocked. Tested once on 2026: the as-shipped high + low at the inland airports (tables learned without the
// station) and the four SAWS towns (never used), pooled MAE, t1 and t0, three source assignments; the change
// ships only when the whole interval is below zero everywhere; per-region guard.
//   node review/accuracy/v3/inland.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RUN_MODELS } from '../v2/stations.mjs';
import { SYNOP_STATIONS } from '../v2/fetch-synop.mjs';
import { DATA, RESULTS, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, loadRuns, days, hourKey } from '../v2/lib.mjs';
import { CONS, buildRows, learn, consensus } from '../v2/tempcore.mjs';
import { appBlend, VARIANTS } from '../v2/temps-replay.mjs';
import { inLowveld } from '../../../api/_lib/precision.js';
import { gridElevation } from './lib3.mjs';

const A = 0.5;
const KEY = { max: 'obsMax', min: 'obsMin' };
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const prevDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10);

function townRows(lead) {
  const ext = new Map();
  const groupT = (tok) => (/^[12][01]\d{3}$/.test(tok) ? (tok[1] === '1' ? -1 : 1) * Number(tok.slice(2)) / 10 : null);
  for (const f of readdirSync(DATA).filter((x) => /^synop-\d{3}-\d{6}\.txt$/.test(x))) {
    for (const line of readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
      const m = /^(\d{5}),(\d{4}),(\d{2}),(\d{2}),(\d{2}),(\d{2}),AAXX (.*)$/.exec(line.trim());
      if (!m || !SYNOP_STATIONS.some((s) => s.id === m[1])) continue;
      const sec3 = m[7].replace(/=+$/, '').split(/\s+333\s+/)[1]?.split(/\s+555\s+/)[0]?.split(/\s+/) || [];
      const k = `${m[1]}|${m[2]}-${m[3]}-${m[4]}`, e = ext.get(k) || {};
      if (m[5] === '18') { const tx = sec3.find((t) => t[0] === '1' && groupT(t) !== null); if (tx) e.max = groupT(tx); }
      if (m[5] === '06') { const tn = sec3.find((t) => t[0] === '2' && groupT(t) !== null); if (tn) e.min = groupT(tn); }
      ext.set(k, e);
    }
  }
  const rows = [];
  for (const st of SYNOP_STATIONS) {
    const R = Object.fromEntries(RUN_MODELS.map((mdl) => [mdl, loadRuns(st.id, mdl)]));
    for (const d of days('2025-01-02', '2026-09-24')) {
      const e = ext.get(`${st.id}|${d}`); if (!e || (!isNum(e.max) && !isNum(e.min))) continue;
      const fc = {};
      for (const [mdl, runs] of Object.entries(R)) {
        const v = (day, h) => runs.get(hourKey(day, h))?.[lead];
        const hi = []; for (let h = 8; h <= 20; h++) hi.push(v(d, h));
        const lo = []; for (let h = 20; h <= 23; h++) lo.push(v(prevDay(d), h)); for (let h = 0; h <= 8; h++) lo.push(v(d, h));
        const all = []; for (let h = 0; h < 24; h++) all.push(v(d, h));
        const ok = (a) => a.filter(isNum), mx = (a) => (ok(a).length ? Math.max(...ok(a)) : null), mn = (a) => (ok(a).length ? Math.min(...ok(a)) : null);
        fc[mdl] = { max: mx(hi), min: mn(lo), dayHigh: mx(all.slice(7, 19)), fromNowMax: mx(all.slice(6)), fromNowMin: mn(all.slice(6)) };
      }
      rows.push({ id: st.id, region: st.region, lat: st.lat, lon: st.lon, day: d, season: SEASON(d), obsMax: e.max ?? null, obsMin: e.min ?? null, fc });
    }
  }
  return rows;
}

const out = { leads: {} };
for (const lead of ['t1', 't0']) {
  const { rows, stationsUsed } = buildRows(lead);
  const inland = stationsUsed.filter((s) => (gridElevation(s.id) ?? s.elev) >= 500 && !inLowveld(s.lat, s.lon));
  const inIds = new Set(inland.map((s) => s.id));
  const tr = rows.filter((r) => inRange(r.day, TRAIN));
  const te = rows.filter((r) => inIds.has(r.id) && inRange(r.day, TEST));
  const towns = townRows(lead).filter((r) => inRange(r.day, TEST));
  // both sides on 2025 only; airports leave-one-station-out, towns use the tables learned on every airport
  const T = { sa: {}, inl: {} };
  for (const v of ['max', 'min']) {
    T.sa[v] = Object.fromEntries(inland.map((s) => [s.id, learn(tr.filter((r) => r.id !== s.id), v)]));
    T.inl[v] = Object.fromEntries(inland.map((s) => [s.id, learn(tr.filter((r) => inIds.has(r.id) && r.id !== s.id), v)]));
    T.sa[v].TOWN = learn(tr, v); T.inl[v].TOWN = learn(tr.filter((r) => inIds.has(r.id)), v);
  }
  const shipped = (vn, which) => (r, v) => { const a = appBlend(r.fc, VARIANTS[vn], r.lat, r.lon, lead)[v], c = consensus(r, v, T[which][v][inIds.has(r.id) ? r.id : 'TOWN']); return isNum(a) && isNum(c) ? (1 - A) * a + A * c : a; };
  const pairs = (list, fa, fb) => { const it = []; for (const r of list) for (const v of ['max', 'min']) { if (!isNum(r[KEY[v]])) continue; const a = fa(r, v), b = fb(r, v); if (isNum(a) && isNum(b)) it.push({ day: r.day, a: Math.abs(a - r[KEY[v]]), b: Math.abs(b - r[KEY[v]]) }); } return it; };
  const mae = (list, f) => { const e = []; for (const r of list) for (const v of ['max', 'min']) { if (!isNum(r[KEY[v]])) continue; const x = f(r, v); if (isNum(x)) e.push(Math.abs(x - r[KEY[v]])); } return mean(e); };
  const res = { airports: {}, towns: {}, byRegion: {}, weights: {} };
  for (const vn of Object.keys(VARIANTS)) {
    const n = shipped(vn, 'inl'), o = shipped(vn, 'sa');
    res.airports[vn] = { sa: mae(te, o), inland: mae(te, n), diff: bootDiff(pairs(te, n, o), 1000, 7, week) };
    res.towns[vn] = { sa: mae(towns, o), inland: mae(towns, n), diff: bootDiff(pairs(towns, n, o), 1000, 7, week) };
    for (const g of [...new Set([...te, ...towns].map((r) => r.region))]) {
      const l = [...te, ...towns].filter((r) => r.region === g);
      (res.byRegion[g] ||= {})[vn] = { sa: mae(l, o), inland: mae(l, n), diff: bootDiff(pairs(l, n, o), 1000, 7, week) };
    }
  }
  const wsum = (t) => CONS.reduce((s, m) => s + t.w[m], 0);
  for (const v of ['max', 'min']) res.weights[v] = { sa: Object.fromEntries(CONS.map((m) => [m, T.sa[v].TOWN.w[m] / wsum(T.sa[v].TOWN)])), inland: Object.fromEntries(CONS.map((m) => [m, T.inl[v].TOWN.w[m] / wsum(T.inl[v].TOWN)])) };
  res.ships = Object.keys(VARIANTS).every((vn) => res.airports[vn].diff?.hi < 0 && res.towns[vn].diff?.hi < 0);
  res.stations = inland.map((s) => s.id);
  out.leads[lead] = res;
}
out.ships = out.leads.t1.ships && out.leads.t0.ships;
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v3-inland.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));
const f2 = (x) => (isNum(x) ? x.toFixed(2) : '—');
const ci = (b) => (b ? `${f2(b.diff)} [${f2(b.lo)}, ${f2(b.hi)}]` : '—');
for (const [lead, r] of Object.entries(out.leads)) {
  console.log(`\n== ${lead} — inland airports ${r.stations.join(' ')} + four towns; pooled high + low MAE, SA table → inland table`);
  for (const vn of Object.keys(VARIANTS)) console.log(`  ${vn.padEnd(12)} airports ${f2(r.airports[vn].sa)} → ${f2(r.airports[vn].inland)} ${ci(r.airports[vn].diff)} · towns ${f2(r.towns[vn].sa)} → ${f2(r.towns[vn].inland)} ${ci(r.towns[vn].diff)}`);
  for (const [g, m] of Object.entries(r.byRegion)) console.log(`  ${g.padEnd(14)} ${Object.entries(m).map(([vn, x]) => `${vn}: ${f2(x.sa)}→${f2(x.inland)}${x.diff?.lo > 0 ? ' WORSE' : x.diff?.hi < 0 ? ' better' : ''}`).join(' · ')}`);
  console.log('  weights (min):', Object.entries(r.weights.min.inland).map(([m, w]) => `${m.split('_')[0]} ${(r.weights.min.sa[m] * 100).toFixed(0)}→${(w * 100).toFixed(0)}%`).join(' · '));
  console.log('  weights (max):', Object.entries(r.weights.max.inland).map(([m, w]) => `${m.split('_')[0]} ${(r.weights.max.sa[m] * 100).toFixed(0)}→${(w * 100).toFixed(0)}%`).join(' · '));
  console.log(`  ships at ${lead}: ${r.ships}`);
}
console.log(`\nSHIPS: ${out.ships}`);
