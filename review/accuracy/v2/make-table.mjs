// Write api/_lib/precision-table.js — the table the app carries — from the scored code (tempcore.mjs).
//   node review/accuracy/v2/make-table.mjs [--check]
// The method was proven on 2026 after learning on 2025 (temps.mjs, results/temps-t0.json / temps-t1.json);
// the shipped table is then refit on all of 2025 + 2026 (Fable, plan review item 8). Day 0 (today) uses the
// latest-run lead t0, day 1 (tomorrow) the 24-hours-before lead t1. α is the pre-registered shipped weight:
// the smallest over leads and source assignments, each already capped at 0.5 (PLAN.md).
// --check: exit 1 if the committed table differs from what this would write (the drift gate; needs the
// downloaded data in review/accuracy/v2/data/, so it runs on the PC that has them).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONS, SEASONS, buildRows, learn } from './tempcore.mjs';
import { PERIOD } from './stations.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(here, '../../../api/_lib/precision-table.js');
const r3 = (x) => Math.round(x * 1000) / 1000;

const alphas = [];
const results = {};
for (const lead of ['t0', 't1']) {
  const f = path.join(here, 'results', `temps-${lead}.json`);
  if (!existsSync(f)) throw new Error(`run temps.mjs --lead ${lead} first`);
  const res = JSON.parse(readFileSync(f, 'utf8'));
  results[lead] = res;
  for (const b of Object.values(res.primary)) {
    if (!(b.hi < 0)) throw new Error(`${lead}: the ship test failed (${JSON.stringify(b)}) — no table is written`);
    alphas.push(b.alpha);
  }
}
const alpha = Math.min(...alphas);
// The region guard (PLAN.md: a region clearly made worse blocks the change there): a region whose whole
// interval is above zero under any source assignment, at either lead. Production blocks it (precision.js
// inLowveld); nothing is written if the guard finds a region production does not block, or stops finding one.
const BLOCKED = ['Lowveld'];
if (!results.t0.regionGuard || !results.t1.regionGuard) throw new Error('the results carry no region guard — re-run temps.mjs');
const worse = [...new Set(Object.values(results).flatMap((res) => Object.entries(res.regionGuard)
  .filter(([, m]) => Object.values(m).some((b) => b && b.lo > 0)).map(([g]) => g)))].sort();
if (worse.join() !== BLOCKED.join()) throw new Error(`the region guard finds ${worse.join(', ') || 'no region'} made worse; production blocks ${BLOCKED.join(', ')} — change precision.js and BLOCKED together`);

const days = [];
let stations = [];
for (const lead of ['t0', 't1']) {
  const { rows, stationsUsed } = buildRows(lead);
  stations = stationsUsed.map((s) => s.id);
  // The ship test must have been run on exactly this data (Fable, code review): same stations, same end.
  if (results[lead].stations.join() !== stations.join() || results[lead].test.to !== PERIOD.to) {
    throw new Error(`results/temps-${lead}.json was scored on ${results[lead].stations.join(' ')} to ${results[lead].test.to}, the data now holds ${stations.join(' ')} to ${PERIOD.to} — re-run temps.mjs`);
  }
  const t = {};
  for (const v of ['max', 'min']) {
    const fit = learn(rows, v);
    const wSum = CONS.reduce((s, m) => s + fit.w[m], 0);
    t[v] = {
      bias: Object.fromEntries(CONS.map((m) => [m, Object.fromEntries(SEASONS.map((s) => [s, r3(fit.bias[m][s])]))])),
      w: Object.fromEntries(CONS.map((m) => [m, r3(fit.w[m] / wSum)])),
    };
  }
  days.push(t);
}
const table = { id: `v2-${PERIOD.from}-${PERIOD.to}`, alpha, models: CONS, trainedOn: `${PERIOD.from}..${PERIOD.to}`, stations, blocked: BLOCKED, days };

// The inland table (review/accuracy/v3/PLAN.md §4, results/v3-inland.json; Fable, rain / fog / frost ruling 4):
// learned on the inland airports only (grid elevation ≥ 500 m, the Lowveld out) and used in the regions where it
// beat the all-SA table with the whole interval below zero under every source assignment at both leads. The
// refit on 2025 + 2026 ships only when every weight is within 3 points of the table that was tested (2025 only);
// otherwise the tested table ships.
const inlandFile = path.join(here, 'results', 'v3-inland.json');
if (!existsSync(inlandFile)) throw new Error('run review/accuracy/v3/inland.mjs first');
const inlandRes = JSON.parse(readFileSync(inlandFile, 'utf8'));
if (!inlandRes.ships) throw new Error('the inland test did not pass — no inland table is written');
if (inlandRes.period?.from !== PERIOD.from || inlandRes.period?.to !== PERIOD.to) throw new Error(`results/v3-inland.json was scored on ${JSON.stringify(inlandRes.period)}, the data now holds ${PERIOD.from} → ${PERIOD.to} — re-run review/accuracy/v3/inland.mjs`);
if (inlandRes.leads.t0.stations.join() !== inlandRes.leads.t1.stations.join()) throw new Error('the inland results used different stations at the two leads');
for (const g of Object.keys(inlandRes.leads.t1.byRegion)) if (!inlandRes.leads.t0.byRegion[g]) throw new Error(`region ${g} is missing from the t0 inland results`);
const INLAND_REGIONS = Object.keys(inlandRes.leads.t1.byRegion)
  .filter((g) => ['t0', 't1'].every((l) => Object.values(inlandRes.leads[l].byRegion[g] || {}).every((x) => x.diff?.hi < 0))).sort();
const inlandIds = inlandRes.leads.t1.stations;
const inlandDays = [];
const inlandFrom = [];
for (const lead of ['t0', 't1']) {
  const { rows } = buildRows(lead);
  const inl = rows.filter((r) => inlandIds.includes(r.id));
  const t = {};
  for (const v of ['max', 'min']) {
    const norm = (fit) => { const s = CONS.reduce((a, m) => a + fit.w[m], 0); return Object.fromEntries(CONS.map((m) => [m, fit.w[m] / s])); };
    const refit = learn(inl, v), tested = inlandRes.leads[lead].weights[v].inland;
    const close = CONS.every((m) => Math.abs(norm(refit)[m] - tested[m]) <= 0.03);
    const fit = close ? refit : learn(inl.filter((r) => r.day <= '2025-12-31'), v);
    inlandFrom.push(`${lead} ${v}: ${close ? 'refit 2025–2026' : 'tested 2025'}`);
    t[v] = {
      bias: Object.fromEntries(CONS.map((m) => [m, Object.fromEntries(SEASONS.map((s) => [s, r3(fit.bias[m][s])]))])),
      w: Object.fromEntries(CONS.map((m) => [m, r3(norm(fit)[m])])),
    };
  }
  inlandDays.push(t);
}
const inlandTable = { id: `v3-inland-${PERIOD.from}-${PERIOD.to}`, alpha, models: CONS, trainedOn: inlandFrom.join('; '), stations: inlandIds,
  regions: INLAND_REGIONS, minElevation: 500, days: inlandDays };

const text = `// GENERATED by review/accuracy/v2/make-table.mjs — do not edit by hand; re-run it (and --check guards drift).
// The corrected five-model consensus for today's (days[0], latest-run lead) and tomorrow's (days[1], 24-h lead)
// high and low: per model, a seasonal bias (°C, model minus airport) and a weight (sums to 1). Learned at
// ${stations.length} SA airports (${stations.join(' ')}), ${PERIOD.from} → ${PERIOD.to}.
// Blocked where the backtest found it made things worse: ${BLOCKED.join(', ')} (precision.js).
export const PRECISION_TABLE = ${JSON.stringify(table, null, 2)};

// The inland table (review/accuracy/v3): learned at the inland airports (${inlandIds.join(' ')}); used in
// ${INLAND_REGIONS.join(', ')} where the place is ${inlandTable.minElevation} m or higher.
export const PRECISION_TABLE_INLAND = ${JSON.stringify(inlandTable, null, 2)};
`;
if (process.argv.includes('--check')) {
  const lf = (x) => x.replace(/\r\n/g, '\n');   // a Windows checkout writes CRLF; the content is what matters
  const now = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
  if (lf(now) !== lf(text)) { console.error('precision-table.js differs from the generator output'); process.exit(1); }
  console.log('precision-table.js matches the generator');
} else {
  writeFileSync(TARGET, text);
  console.log(`wrote ${path.relative(process.cwd(), TARGET)} — α ${alpha}, ${stations.length} stations`);
}
