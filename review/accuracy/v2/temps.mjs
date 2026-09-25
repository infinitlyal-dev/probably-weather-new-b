// TODAY'S / TOMORROW'S HIGH AND LOW — each single model, the app's blend, and the corrected consensus.
//   node review/accuracy/v2/temps.mjs [--lead t1|t0]
// Plan: review/accuracy/v2/PLAN.md (with Fable's changes). Truth: METAR hourly temperatures at the scored
// airports — a station-day counts only with ≥ 20 of 24 hours reported (East London: 07–19 all present,
// high only, forecasts over the same hours). Forecasts: real past forecasts (previous-runs API);
// t1 = the value given 24 h before the hour (≈ tomorrow as seen today), t0 = the latest run (≈ today).
// Learned on TRAIN (2025); every number is on TEST (2026). Bootstrap blocks are 7 days.
// PRE-REGISTERED PRIMARY: the mix (the app's blend + α × the corrected consensus, α chosen on 2025) vs
// the app now, t1, MAE of high and low pooled, all stations, under each of the three source assignments.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TRAIN, TEST, inRange, isNum, mean, round, bootDiff, RESULTS } from './lib.mjs';
import { RUN_MODELS } from './stations.mjs';
import { CONS, KEY, H0, buildRows, learn, consensus } from './tempcore.mjs';
import { inLowveld } from '../../../api/_lib/precision.js';

const args = process.argv.slice(2);
const LEAD = args.includes('--lead') ? args[args.indexOf('--lead') + 1] : 't1';
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const boot = (items) => bootDiff(items, 1000, 7, week);

// ---- the app now: production's blend replayed (temps-replay.mjs, shared with synop-check.mjs) ----
import { appBlend as replay, VARIANTS } from './temps-replay.mjs';
const appBlend = (fc, slots, lat, lon) => replay(fc, slots, lat, lon, LEAD);

// ---- station-days (tempcore.mjs: the same code make-table.mjs learns the shipped table with) ----
const { rows, stationsUsed } = buildRows(LEAD);
const train = rows.filter((r) => inRange(r.day, TRAIN));
const test = rows.filter((r) => inRange(r.day, TEST));

// ---- tables: per model bias by season, inverse-MSE weights ----
const T = { station: {}, saLoso: {}, sa: {} };
for (const v of ['max', 'min']) {
  T.station[v] = {}; T.saLoso[v] = {};
  for (const st of stationsUsed) {
    T.station[v][st.id] = learn(train.filter((r) => r.id === st.id), v);
    T.saLoso[v][st.id] = learn(train.filter((r) => r.id !== st.id), v);   // what a place without an airport gets
  }
  T.sa[v] = learn(train, v);                                              // the table production would carry
}

// ---- the mix: (1 − α) · app + α · consensus (SA table learned without the station), α on TRAIN ----
const ALPHAS = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1];
const alpha = {};
for (const [vn, slots] of Object.entries(VARIANTS)) {
  let best = null;
  for (const a of ALPHAS) {
    const e = [];
    for (const r of train) for (const v of ['max', 'min']) {
      if (!isNum(r[KEY[v]])) continue;
      const app = appBlend(r.fc, slots, r.lat, r.lon)[v], c = consensus(r, v, T.saLoso[v][r.id]);
      if (isNum(app) && isNum(c)) e.push(Math.abs((1 - a) * app + a * c - r[KEY[v]]));
    }
    const mae = mean(e); if (!best || mae < best.mae) best = { a, mae };
  }
  alpha[vn] = best.a;
}
// Pre-registered (PLAN.md): the shipped weight is capped at 0.5 until the live record earns more.
const shipped = Object.fromEntries(Object.entries(alpha).map(([vn, a]) => [vn, Math.min(a, 0.5)]));

// ---- methods, scored on TEST ----
const methods = {};
for (const m of RUN_MODELS) methods[`model: ${m}`] = (r, v) => r.fc[m][v];
for (const [vn, slots] of Object.entries(VARIANTS)) methods[`app now (${vn})`] = (r, v) => appBlend(r.fc, slots, r.lat, r.lon)[v];
methods['five-model mean, no tables'] = (r, v) => mean(CONS.map((m) => r.fc[m][v]));
methods['consensus, SA table (without this station)'] = (r, v) => consensus(r, v, T.saLoso[v][r.id]);
methods['consensus, own station table (upper bound)'] = (r, v) => consensus(r, v, T.station[v][r.id]);
for (const [vn, slots] of Object.entries(VARIANTS)) methods[`shipped mix (${vn}), α=${shipped[vn]}`] = (r, v) => { const app = appBlend(r.fc, slots, r.lat, r.lon)[v], c = consensus(r, v, T.saLoso[v][r.id]); return isNum(app) && isNum(c) ? (1 - shipped[vn]) * app + shipped[vn] * c : app; };
// What production does after the region guard (PLAN.md, results): the shipped mix, except the Lowveld keeps the
// app as it is (precision.js inLowveld). Reported for Al's page; the ship test above is the pre-registered one.
for (const vn of Object.keys(VARIANTS)) methods[`as shipped (${vn})`] = (r, v) => (inLowveld(r.lat, r.lon) ? methods[`app now (${vn})`] : methods[`shipped mix (${vn}), α=${shipped[vn]}`])(r, v);
for (const [vn, slots] of Object.entries(VARIANTS)) methods[`mix (${vn}), α=${alpha[vn]}`] =(r, v) => { const app = appBlend(r.fc, slots, r.lat, r.lon)[v], c = consensus(r, v, T.saLoso[v][r.id]); return isNum(app) && isNum(c) ? (1 - alpha[vn]) * app + alpha[vn] * c : app; };

const errs = (list, v, f) => list.filter((r) => isNum(r[KEY[v]])).map((r) => { const x = f(r, v); return isNum(x) ? x - r[KEY[v]] : null; }).filter(isNum);
const score = (list, v, f) => { const e = errs(list, v, f); return e.length ? { n: e.length, mae: mean(e.map(Math.abs)), bias: mean(e), within2: e.filter((x) => Math.abs(x) <= 2).length / e.length } : null; };
const pooled = (list, f) => { const e = [...errs(list, 'max', f), ...errs(list, 'min', f)]; return e.length ? { n: e.length, mae: mean(e.map(Math.abs)), within2: e.filter((x) => Math.abs(x) <= 2).length / e.length } : null; };
const pairItems = (list, fa, fb) => { const it = []; for (const r of list) for (const v of ['max', 'min']) { if (!isNum(r[KEY[v]])) continue; const a = fa(r, v), b = fb(r, v); if (isNum(a) && isNum(b)) it.push({ day: r.day, a: Math.abs(a - r[KEY[v]]), b: Math.abs(b - r[KEY[v]]) }); } return it; };

const out = { lead: LEAD, train: TRAIN, test: TEST, stations: stationsUsed.map((s) => s.id), consensusModels: CONS, alpha, shipped, overall: {}, pooled: {}, byRegion: {}, byStation: {}, primary: {}, secondary: {}, transfer: {}, frost: {} };
for (const v of ['max', 'min']) out.overall[v] = Object.fromEntries(Object.entries(methods).map(([n, f]) => [n, score(test, v, f)]));
out.pooled = Object.fromEntries(Object.entries(methods).map(([n, f]) => [n, pooled(test, f)]));
const regions = [...new Set(stationsUsed.map((s) => s.region))];
out.byRegion = Object.fromEntries(regions.map((g) => [g, Object.fromEntries(Object.entries(methods).map(([n, f]) => [n, pooled(test.filter((r) => r.region === g), f)]))]));
out.byStation = Object.fromEntries(stationsUsed.map((s) => [s.id, Object.fromEntries(Object.entries(methods).map(([n, f]) => [n, pooled(test.filter((r) => r.id === s.id), f)]))]));

// PRIMARY: each mix vs its app now, pooled high+low MAE, all stations
for (const vn of Object.keys(VARIANTS)) out.primary[vn] = { alpha: shipped[vn], alphaTrain: alpha[vn], ...boot(pairItems(test, methods[`shipped mix (${vn}), α=${shipped[vn]}`], methods[`app now (${vn})`])) };
for (const vn of Object.keys(VARIANTS)) out.secondary[`uncapped mix (${vn}), α=${alpha[vn]} vs app now`] = boot(pairItems(test, methods[`mix (${vn}), α=${alpha[vn]}`], methods[`app now (${vn})`]));
// REGION GUARD (PLAN.md: "a region clearly made worse blocks the change there"): each shipped mix vs its
// app now inside each region. A whole interval above zero under any assignment, at either lead, blocks it.
out.regionGuard = Object.fromEntries(regions.map((g) => [g, Object.fromEntries(Object.keys(VARIANTS).map((vn) => [vn, boot(pairItems(test.filter((r) => r.region === g), methods[`shipped mix (${vn}), α=${shipped[vn]}`], methods[`app now (${vn})`]))]))]));
// SECONDARY: vs the best single model (pooled), and the consensus vs the untabled mean
const bestModel = RUN_MODELS.map((m) => [m, out.pooled[`model: ${m}`]?.mae ?? 99]).sort((a, b) => a[1] - b[1])[0][0];
out.secondary.bestModel = bestModel;
for (const vn of Object.keys(VARIANTS)) out.secondary[`shipped mix (${vn}) vs best model`] = boot(pairItems(test, methods[`shipped mix (${vn}), α=${shipped[vn]}`], (r, v) => r.fc[bestModel][v]));
for (const vn of Object.keys(VARIANTS)) out.secondary[`as shipped (${vn}) vs app now`] = boot(pairItems(test, methods[`as shipped (${vn})`], methods[`app now (${vn})`]));
for (const vn of Object.keys(VARIANTS)) out.secondary[`as shipped (${vn}) vs best model`] = boot(pairItems(test, methods[`as shipped (${vn})`], (r, v) => r.fc[bestModel][v]));
out.secondary['consensus (SA table) vs best model'] = boot(pairItems(test, methods['consensus, SA table (without this station)'], (r, v) => r.fc[bestModel][v]));
out.secondary['consensus (SA table) vs five-model mean'] = boot(pairItems(test, methods['consensus, SA table (without this station)'], methods['five-model mean, no tables']));
for (const vn of Object.keys(VARIANTS)) out.secondary[`consensus (SA table) vs app now (${vn})`] = boot(pairItems(test, methods['consensus, SA table (without this station)'], methods[`app now (${vn})`]));

// TRANSFER: a neighbour's station table applied here, vs the SA table and the untabled mean
const PAIRS = [['FAOR', 'FAWB'], ['FAWB', 'FAOR'], ['FAKN', 'FAHS'], ['FAHS', 'FAKN'], ['FAUP', 'FAKM'], ['FAKM', 'FAUP'], ['FAPE', 'FAEL'], ['FAPE', 'FAUT']];
for (const [from, to] of PAIRS) {
  if (!T.station.max[from] || !T.station.max[to]) continue;
  const list = test.filter((r) => r.id === to);
  const viaNeighbour = (r, v) => consensus(r, v, T.station[v][from]);
  const sFrom = stationsUsed.find((s) => s.id === from), sTo = stationsUsed.find((s) => s.id === to);
  out.transfer[`${from}→${to}`] = { dAlt: sTo.elev - sFrom.elev, neighbourTable: pooled(list, viaNeighbour), saTable: pooled(list, methods['consensus, SA table (without this station)']), untabledMean: pooled(list, methods['five-model mean, no tables']), ownTable: pooled(list, methods['consensus, own station table (upper bound)']),
    neighbourVsSa: boot(pairItems(list, viaNeighbour, methods['consensus, SA table (without this station)'])) };
}
// FROST nights (observed low ≤ 2 °C)
const frost = test.filter((r) => isNum(r.obsMin) && r.obsMin <= 2);
out.frost = { nights: frost.length, byStation: Object.fromEntries(stationsUsed.map((s) => [s.id, frost.filter((r) => r.id === s.id).length]).filter(([, n]) => n)),
  methods: Object.fromEntries(Object.entries(methods).map(([n, f]) => { const e = frost.map((r) => { const x = f(r, 'min'); return isNum(x) ? { err: x - r.obsMin, called: x <= 2 } : null; }).filter(Boolean); return [n, { n: e.length, mae: mean(e.map((x) => Math.abs(x.err))), bias: mean(e.map((x) => x.err)), called: e.filter((x) => x.called).length }]; })) };
out.tables = T.sa; // the all-SA table (what production would carry), learned on TRAIN
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, `temps-${LEAD}.json`), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));

// ---- console ----
const f2 = (x) => (isNum(x) ? x.toFixed(2) : '—');
const ci = (b) => (b ? `${f2(b.diff)} [${f2(b.lo)}, ${f2(b.hi)}] (${b.days} weeks)` : '—');
console.log(`TEMPERATURES, lead ${LEAD}, TEST ${TEST.from}→${TEST.to}, ${stationsUsed.length} stations: ${stationsUsed.map((s) => s.id).join(' ')}`);
console.log(`\nPooled high+low (MAE °C · within 2 °C):`);
for (const [n, s] of Object.entries(out.pooled)) if (s) console.log(`  ${n.padEnd(46)} ${f2(s.mae)} · ${(s.within2 * 100).toFixed(0)}%  n=${s.n}`);
for (const v of ['max', 'min']) { console.log(`\n${v === 'max' ? 'HIGH' : 'LOW'} (MAE · bias):`); for (const [n, s] of Object.entries(out.overall[v])) if (s) console.log(`  ${n.padEnd(46)} ${f2(s.mae)} · ${s.bias >= 0 ? '+' : ''}${f2(s.bias)}`); }
console.log('\nPRIMARY (shipped mix − app now, pooled MAE; negative = better):');
for (const [vn, b] of Object.entries(out.primary)) console.log(`  ${vn.padEnd(12)} α=${b.alpha} (2025 chose ${b.alphaTrain}): ${ci(b)}`);
console.log('\nREGION GUARD (shipped mix − app now inside the region; whole interval above zero = made worse):');
for (const [g, m] of Object.entries(out.regionGuard)) console.log(`  ${g.padEnd(14)} ${Object.entries(m).map(([vn, b]) => `${vn}: ${ci(b)}${b && b.lo > 0 ? ' WORSE' : ''}`).join(' · ')}`);
console.log(`\nSECONDARY (best single model: ${bestModel}):`);
for (const [n, b] of Object.entries(out.secondary)) if (n !== 'bestModel') console.log(`  ${n.padEnd(48)} ${ci(b)}`);
console.log('\nTRANSFER (pooled MAE at the second station):');
for (const [p, t] of Object.entries(out.transfer)) console.log(`  ${p.padEnd(10)} Δalt ${String(t.dAlt).padStart(5)} m · neighbour table ${f2(t.neighbourTable?.mae)} · SA table ${f2(t.saTable?.mae)} · untabled mean ${f2(t.untabledMean?.mae)} · own table ${f2(t.ownTable?.mae)} · neighbour−SA ${ci(t.neighbourVsSa)}`);
console.log(`\nFROST nights (obs low ≤ 2 °C): ${out.frost.nights}`, JSON.stringify(out.frost.byStation));
for (const [n, s] of Object.entries(out.frost.methods)) if (s.n) console.log(`  ${n.padEnd(46)} low MAE ${f2(s.mae)} bias ${f2(s.bias)} frost called ${s.called}/${s.n}`);
