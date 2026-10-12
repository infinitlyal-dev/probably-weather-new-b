// The coast switch, proved hour for hour (Maat's ruling, 12 Oct 2026): every inland hour must come out of the
// branch EXACTLY as it comes out of today's code — every column run-eval.mjs writes, not just the hero. The coast
// hours that differ are listed by what changed.
//   node review/accuracy/run-eval.mjs --tag switch-main     (on main)
//   node review/accuracy/run-eval.mjs --tag rain-switch     (on fix/rain-now-descriptive)
//   node review/accuracy/rain-now-switch-proof.mjs <main-hours.csv> <branch-hours.csv>
// Refuses (exit 1) unless both files are the full corpus — every CITIES airport, the same unique airport-hours,
// the columns the proof reads — and the branch file shows the switch working (coast hours changed); then exits 0
// only if no inland hour differs in any column.
import { readFileSync, realpathSync } from 'node:fs';
import { regionOf } from '../../api/_lib/regions.js';
import { RAIN_NOW_DESC_REGIONS } from '../../api/weather.js';
import { CITIES } from './lib/sources.mjs';

const fail = (msg) => { console.error(`REFUSED: ${msg}`); process.exit(1); };
const [fa, fb] = process.argv.slice(2);
if (!fa || !fb) fail('two hour dumps are needed: <main-hours.csv> <branch-hours.csv>');
if (realpathSync(fa) === realpathSync(fb)) fail('the same file twice');
const parse = (f) => {
  const [h, ...ls] = readFileSync(f, 'utf8').split('\n').filter(Boolean);
  const cols = (h || '').split(',');
  return { cols, rows: ls.map((l) => { const v = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(cur); cur = ''; } else cur += ch; } v.push(cur); return v; }) };
};
const A = parse(fa), B = parse(fb);
const NEED = ['icao', 'time', 'display', 'server', 'serverReason', 'obsPrecip'];
for (const c of NEED) if (!A.cols.includes(c)) fail(`column ${c} missing`);
if (A.cols.join() !== B.cols.join()) fail('the two dumps have different columns');
if (A.rows.length !== B.rows.length) fail(`row counts differ (${A.rows.length} vs ${B.rows.length})`);
const ci = (c) => A.cols.indexOf(c);
const keys = new Set();
for (const r of A.rows) { if (r.length !== A.cols.length) fail('a short row'); const k = `${r[ci('icao')]}|${r[ci('time')]}`; if (keys.has(k)) fail(`duplicate hour ${k}`); keys.add(k); }
const seen = new Set(A.rows.map((r) => r[ci('icao')]));
for (const icao of Object.keys(CITIES)) if (!seen.has(icao)) fail(`airport ${icao} missing`);
for (const icao of seen) if (!CITIES[icao]) fail(`unknown airport ${icao}`);
// The whole published corpus (README: 12,740 replayed hours), nothing truncated.
const EXPECTED_HOURS = 12740;
if (A.rows.length !== EXPECTED_HOURS) fail(`${A.rows.length} hours, the corpus is ${EXPECTED_HOURS}`);
// Which file is which, by content: today's code never gives the new reason; the branch gives it somewhere.
const NEW = 'rain-now-descriptive';
if (A.rows.some((r) => r[ci('serverReason')] === NEW)) fail('the first file has rain-now-descriptive hours: it is not today\'s code');
if (!B.rows.some((r) => r[ci('serverReason')] === NEW)) fail('the second file has no rain-now-descriptive hour: it is not the branch');

const t = (x) => x === 'true';
const out = {};
for (let i = 0; i < A.rows.length; i++) {
  const a = A.rows[i], b = B.rows[i], icao = a[ci('icao')];
  if (b.length !== B.cols.length || icao !== b[ci('icao')] || a[ci('time')] !== b[ci('time')]) fail(`row ${i} is not the same hour`);
  const region = regionOf(CITIES[icao].lat, CITIES[icao].lon);
  const o = (out[icao] ||= { region, coast: RAIN_NOW_DESC_REGIONS.includes(region), hours: 0, differing: 0, cols: {}, toRain: 0, toRainWet: 0, fromMightRain: 0 });
  o.hours++;
  const diff = A.cols.filter((c, k) => a[k] !== b[k]);
  if (!diff.length) continue;
  o.differing++;
  // a coast hour may change only by becoming the new rung's rain
  if (o.coast && !(b[ci('serverReason')] === NEW && b[ci('display')] === 'rain')) o.unexplained = (o.unexplained || 0) + 1;
  for (const c of diff) o.cols[c] = (o.cols[c] || 0) + 1;
  if (b[ci('display')] === 'rain' && a[ci('display')] !== 'rain') { o.toRain++; if (t(a[ci('obsPrecip')])) o.toRainWet++; if (a[ci('display')] === 'rain-possible') o.fromMightRain++; }
}
const total = Object.values(out).reduce((s, o) => s + o.hours, 0);
console.log(`${total} airport-hours, ${Object.keys(out).length} airports`);
for (const [icao, o] of Object.entries(out)) {
  console.log(`${icao} ${o.region.padEnd(13)} ${o.coast ? 'COAST ' : 'inland'} ${o.hours} hours, ${o.differing} differ` +
    (o.differing ? ` — now "Rain's here" ${o.toRain} (${o.toRainWet} wet at the airport; ${o.fromMightRain} were might-rain); columns: ${Object.entries(o.cols).map(([c, n]) => `${c} ${n}`).join(', ')}` : ''));
}
const coastDiff = Object.values(out).filter((o) => o.coast).reduce((s, o) => s + o.differing, 0);
if (coastDiff === 0) fail('no coast hour changed: the branch dump does not look like the switch ran (or both files are main)');
const unexplained = Object.values(out).reduce((s, o) => s + (o.unexplained || 0), 0);
if (unexplained) fail(`${unexplained} coast hours changed without becoming rain-now-descriptive rain`);
const inlandDiff = Object.values(out).filter((o) => !o.coast).reduce((s, o) => s + o.differing, 0);
const inlandHours = Object.values(out).filter((o) => !o.coast).reduce((s, o) => s + o.hours, 0);
console.log(inlandDiff === 0 ? `INLAND: identical to today, all ${inlandHours} hours, every column.` : `INLAND: ${inlandDiff} of ${inlandHours} hours differ — NOT identical`);
process.exit(inlandDiff === 0 ? 0 : 1);
