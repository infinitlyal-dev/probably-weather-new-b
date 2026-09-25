// THE KAROO AND KZN INLAND — the two regions without an hourly airport record, checked on SA Weather
// Service synoptic reports (Ogimet archive): the daytime maximum (the 18:00 UTC report's 333 1-group, over
// 08:00–20:00 SAST) and the overnight minimum (the 06:00 UTC report's 333 2-group, over 20:00–08:00 SAST).
// The forecasts are read over the same windows. The consensus uses the all-SA table learned at the AIRPORTS
// on 2025 (tempcore.mjs) — so these towns are out of sample in place and in time. Scored on TEST (2026).
//   node review/accuracy/v2/synop-check.mjs [--lead t1|t0]
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RUN_MODELS } from './stations.mjs';
import { SYNOP_STATIONS } from './fetch-synop.mjs';
import { DATA, RESULTS, TRAIN, TEST, inRange, SEASON, isNum, mean, round, bootDiff, loadRuns, days, hourKey } from './lib.mjs';
import { CONS, buildRows, learn, consensus } from './tempcore.mjs';

const args = process.argv.slice(2);
const LEAD = args.includes('--lead') ? args[args.indexOf('--lead') + 1] : 't1';
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const maxOf = (a) => { const v = a.filter(isNum); return v.length ? Math.max(...v) : null; };
const minOf = (a) => { const v = a.filter(isNum); return v.length ? Math.min(...v) : null; };
const prevDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10);

// ---- SYNOP: daytime max / overnight min per station and SAST date ----
const ext = new Map();   // `${id}|${date}` → { max, min }
const groupT = (tok) => (/^[12][01]\d{3}$/.test(tok) ? (tok[1] === '1' ? -1 : 1) * Number(tok.slice(2)) / 10 : null);
for (const f of readdirSync(DATA).filter((x) => /^synop-\d{3}-\d{6}\.txt$/.test(x))) {
  for (const line of readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
    const m = /^(\d{5}),(\d{4}),(\d{2}),(\d{2}),(\d{2}),(\d{2}),AAXX (.*)$/.exec(line.trim());
    if (!m || !SYNOP_STATIONS.some((s) => s.id === m[1])) continue;
    const [, id, y, mo, d, hh] = m;
    const body = m[7].replace(/=+$/, '');
    const sec3 = body.split(/\s+333\s+/)[1]?.split(/\s+555\s+/)[0]?.split(/\s+/) || [];
    const date = `${y}-${mo}-${d}`; // UTC date; 06Z and 18Z are both on the same SAST date
    const k = `${id}|${date}`; const e = ext.get(k) || {};
    if (hh === '18') { const tx = sec3.find((t) => t[0] === '1' && groupT(t) !== null); if (tx) e.max = groupT(tx); }
    if (hh === '06') { const tn = sec3.find((t) => t[0] === '2' && groupT(t) !== null); if (tn) e.min = groupT(tn); }
    ext.set(k, e);
  }
}

// ---- forecasts over the same windows ----
const rows = [];
for (const st of SYNOP_STATIONS) {
  const runs = Object.fromEntries(RUN_MODELS.map((mdl) => [mdl, loadRuns(st.id, mdl)]).filter(([, v]) => v));
  if (Object.keys(runs).length < RUN_MODELS.length) { console.error(`${st.id} ${st.name}: past runs missing`); continue; }
  for (const d of days('2025-01-02', '2026-09-24')) {
    const e = ext.get(`${st.id}|${d}`); if (!e || (!isNum(e.max) && !isNum(e.min))) continue;
    const fc = {};
    for (const [mdl, R] of Object.entries(runs)) {
      const day = (h) => R.get(hourKey(d, h))?.[LEAD];
      const hiW = []; for (let h = 8; h <= 20; h++) hiW.push(day(h));
      const loW = []; for (let h = 20; h <= 23; h++) loW.push(R.get(hourKey(prevDay(d), h))?.[LEAD]); for (let h = 0; h <= 8; h++) loW.push(day(h));
      const all = []; for (let h = 0; h < 24; h++) all.push(day(h));
      fc[mdl] = { max: maxOf(hiW), min: minOf(loW), dayHigh: maxOf(all.slice(7, 19)), fromNowMax: maxOf(all.slice(6)), fromNowMin: minOf(all.slice(6)) };
    }
    rows.push({ id: st.id, name: st.name, region: st.region, lat: st.lat, lon: st.lon, day: d, season: SEASON(d), obsMax: e.max ?? null, obsMin: e.min ?? null, fc });
  }
}

// the all-SA table learned at the airports on 2025 only
const { rows: airport } = buildRows(LEAD);
const saTable = { max: learn(airport.filter((r) => inRange(r.day, TRAIN)), 'max'), min: learn(airport.filter((r) => inRange(r.day, TRAIN)), 'min') };
const { appBlend, VARIANTS } = await import('./temps-replay.mjs');
const test = rows.filter((r) => inRange(r.day, TEST));
const KEY = { max: 'obsMax', min: 'obsMin' };
const A = 0.5;
const methods = {
  ...Object.fromEntries(RUN_MODELS.map((mdl) => [`model: ${mdl}`, (r, v) => r.fc[mdl][v]])),
  ...Object.fromEntries(Object.keys(VARIANTS).map((vn) => [`app now (${vn})`, (r, v) => appBlend(r.fc, VARIANTS[vn], r.lat, r.lon, LEAD)[v]])),
  'consensus (airport table)': (r, v) => consensus(r, v, saTable[v]),
  ...Object.fromEntries(Object.keys(VARIANTS).map((vn) => [`mix α=0.5 (${vn})`, (r, v) => { const a = appBlend(r.fc, VARIANTS[vn], r.lat, r.lon, LEAD)[v], c = consensus(r, v, saTable[v]); return isNum(a) && isNum(c) ? (1 - A) * a + A * c : a; }])),
};
const pooled = (list, fn) => { const e = []; for (const r of list) for (const v of ['max', 'min']) { if (!isNum(r[KEY[v]])) continue; const x = fn(r, v); if (isNum(x)) e.push(x - r[KEY[v]]); } return e.length ? { n: e.length, mae: mean(e.map(Math.abs)), bias: mean(e), within2: e.filter((x) => Math.abs(x) <= 2).length / e.length } : null; };
const pairs = (list, fa, fb) => { const it = []; for (const r of list) for (const v of ['max', 'min']) { if (!isNum(r[KEY[v]])) continue; const a = fa(r, v), b = fb(r, v); if (isNum(a) && isNum(b)) it.push({ day: r.day, a: Math.abs(a - r[KEY[v]]), b: Math.abs(b - r[KEY[v]]) }); } return it; };
const out = { lead: LEAD, test: TEST, stations: SYNOP_STATIONS.map((s) => `${s.id} ${s.name}`), byRegion: {}, byStation: {}, boot: {} };
for (const g of ['Karoo', 'KZN inland']) {
  const list = test.filter((r) => r.region === g);
  out.byRegion[g] = Object.fromEntries(Object.entries(methods).map(([n, fn]) => [n, pooled(list, fn)]));
  out.boot[g] = Object.fromEntries(Object.keys(VARIANTS).map((vn) => [vn, bootDiff(pairs(list, methods[`mix α=0.5 (${vn})`], methods[`app now (${vn})`]), 1000, 7, week)]));
}
for (const st of SYNOP_STATIONS) out.byStation[`${st.id} ${st.name}`] = Object.fromEntries(Object.entries(methods).map(([n, fn]) => [n, pooled(test.filter((r) => r.id === st.id), fn)]));
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, `synop-${LEAD}.json`), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 3) : x), 1));
for (const [g, m] of Object.entries(out.byRegion)) {
  console.log(`\n== ${g} (lead ${LEAD}, TEST) — pooled high+low MAE`);
  for (const [n, s] of Object.entries(m)) if (s) console.log(`  ${n.padEnd(34)} ${s.mae.toFixed(2)} · within 2 °C ${(s.within2 * 100).toFixed(0)}% · n=${s.n}`);
  for (const [vn, b] of Object.entries(out.boot[g])) if (b) console.log(`  mix − app now (${vn}): ${b.diff.toFixed(2)} [${b.lo.toFixed(2)}, ${b.hi.toFixed(2)}]`);
}
