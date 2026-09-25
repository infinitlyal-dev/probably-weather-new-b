// FOG — the visibility–humidity detector (Layer A), replayed on Open-Meteo's archive, against what 13 airports
// reported. Pre-registered in PLAN.md (with Fable's changes): 1 Oct 2025 → 24 Sept 2026 only (Open-Meteo's
// current visibility); hours assigned to noon-to-noon days, then even ISO weeks tune, odd weeks test; the grid
// holds only cells that still fire on Strand's two pinned real fogs; maximise F0.5 on the tune weeks; one
// candidate, tested once.
//   node review/accuracy/v3/fog.mjs
// Replayed: the detector's own gates (visibility < 1.5 km, humidity, dew-point spread, rain % < 30, rain < 0.2 mm)
// on Open-Meteo's archived hour (best_match: visibility and rain % from the short-lead archive; temperature, dew
// point, wind and rain amount from the latest run). Tomorrow.io's visibility has no archive, so the replay is the
// Open-Meteo half of the minimum the app takes; the detector only replaces clear / partly cloudy / cloudy, and
// its own rain gates already exclude wet hours.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SCORED } from '../v2/stations.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, isNum, mean, round, bootDiff, RESULTS } from '../v2/lib.mjs';
import { fogTruth, loadPrev, isoWeek } from './lib3.mjs';

const FROM = '2025-10-01', TO = '2026-09-24';
const NO_TRUTH = new Set(['FALW', 'FAHS', 'FAWB']);     // no present weather, no usable visibility
const rhOf = (t, d) => (isNum(t) && isNum(d) ? 100 * Math.exp((17.625 * d) / (243.04 + d)) / Math.exp((17.625 * t) / (243.04 + t)) : null);
// noon-to-noon day: 12:00–23:59 belong to their date, 00:00–11:59 to the day before (Fable, plan review 3)
const nightOf = (day, h) => (h >= 12 ? day : new Date(Date.parse(`${day}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10));
const weekOf = (d) => { const w = isoWeek(d); return `${w.year}-W${w.week}`; };
const tune = (d) => isoWeek(d).week % 2 === 0;

const rows = [];
for (const st of SCORED.filter((s) => !NO_TRUTH.has(s.id))) {
  const obs = loadObs(st.id), runs = loadRuns(st.id, 'best_match'), hist = loadHist(st.id, 'best_match'), prev = loadPrev(st.id);
  if (!runs || !hist) { console.error(`${st.id}: data missing`); continue; }
  for (const d of days(FROM, TO)) for (let h = 0; h < 24; h++) {
    const k = hourKey(d, h);
    const truth = fogTruth(obs.get(k));
    if (!truth) continue;
    const r = runs.get(k), x = hist.get(k);
    if (!r || !x || !isNum(x.vis)) continue;
    const night = nightOf(d, h);
    if (night < FROM) continue;
    rows.push({ id: st.id, region: st.region, day: d, h, night, week: weekOf(night), tune: tune(night), truth,
      vis: x.vis, pp: x.pp, mm: r.p0, rh: rhOf(r.t0, r.dew), spread: isNum(r.t0) && isNum(r.dew) ? r.t0 - r.dew : null, wind: r.w0, low: prev?.get(k)?.low0 ?? null });
  }
}

// the detector with a cell's gates (visibility fixed below 1,500 m by Strand's 21 May fixture)
const fires = (c) => (x) => x.vis < 1500 && isNum(x.rh) && x.rh >= c.rh && isNum(x.spread) && x.spread <= c.spread
  && (!isNum(x.pp) || x.pp < 30) && (!isNum(x.mm) || x.mm < 0.2) && (c.wind === null || (isNum(x.wind) && x.wind <= c.wind));
const TODAY = { rh: 90, spread: 2, wind: null };
const GRID = [];
for (const rh of [90, 93, 95]) for (const spread of [2, 1.5, 1]) for (const wind of [null, 15, 10]) GRID.push({ rh, spread, wind });
// Strand's pinned real fogs must still fire (hard constraint; every grid cell passes by construction — checked)
const FIXTURES = [{ vis: 1040, rh: 97, spread: 0.4, pp: 0, mm: 0, wind: 6.5 }, { vis: 800, rh: 95, spread: 0.8, pp: 0, mm: 0, wind: 5.2 }];
for (const c of GRID) if (!FIXTURES.every(fires(c))) throw new Error(`cell ${JSON.stringify(c)} misses a Strand fixture`);

const score = (list, fn) => {
  let hits = 0, fa = 0, miss = 0;
  for (const x of list) { const f = fn(x), t = x.truth === 'fog'; if (f && t) hits++; else if (f) fa++; else if (t) miss++; }
  const P = hits + fa ? hits / (hits + fa) : null, R = hits + miss ? hits / (hits + miss) : null;
  const f05 = P && R ? (1.25 * P * R) / (0.25 * P + R) : 0;
  return { n: list.length, fogHours: hits + miss, calls: hits + fa, hits, falseAlarms: fa, precision: P, recall: R, f05, wrongPer1000: (fa / list.length) * 1000 };
};

// ---- tune ----
const tuneRows = rows.filter((x) => x.tune), testRows = rows.filter((x) => !x.tune);
const tuned = GRID.map((c) => ({ c, s: score(tuneRows, fires(c)) })).sort((a, b) => b.s.f05 - a.s.f05);
const chosen = tuned[0].c;

// ---- test: pooled, per region, per station; weekly-block bootstrap on the test weeks ----
const statDiff = (list, fa, fb, key) => {
  // bootstrap the difference of a ratio statistic by resampling whole weeks
  const byWeek = new Map(); for (const x of list) (byWeek.get(x.week) || byWeek.set(x.week, []).get(x.week)).push(x);
  const weeks = [...byWeek.values()];
  if (!weeks.length) return null;
  const stat = (ws) => { const all = ws.flat(); const a = score(all, fa)[key], b = score(all, fb)[key]; return isNum(a) && isNum(b) ? a - b : null; };
  const point = stat(weeks);
  let s = 7 >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const reps = [];
  for (let k = 0; k < 1000; k++) { const pick = []; for (let i = 0; i < weeks.length; i++) pick.push(weeks[Math.floor(rnd() * weeks.length)]); const v = stat(pick); if (isNum(v)) reps.push(v); }
  reps.sort((a, b) => a - b);
  return reps.length >= 900 ? { diff: point, lo: reps[Math.floor(0.025 * reps.length)], hi: reps[Math.ceil(0.975 * reps.length) - 1], weeks: weeks.length } : { diff: point, lo: null, hi: null, weeks: weeks.length };
};
const out = { period: { from: FROM, to: TO }, split: 'noon-to-noon days, even ISO weeks tune / odd test', chosen, today: TODAY,
  tuneTable: tuned.map((t) => ({ ...t.c, f05: t.s.f05, precision: t.s.precision, recall: t.s.recall, calls: t.s.calls })),
  test: {}, byRegion: {}, byStation: {}, instead: {}, fixtures: 'every cell fires on both' };
out.test = { today: score(testRows, fires(TODAY)), chosen: score(testRows, fires(chosen)),
  precision: statDiff(testRows, fires(chosen), fires(TODAY), 'precision'), f05: statDiff(testRows, fires(chosen), fires(TODAY), 'f05'),
  wrongPer1000: statDiff(testRows, fires(chosen), fires(TODAY), 'wrongPer1000'), recall: statDiff(testRows, fires(chosen), fires(TODAY), 'recall') };
const regions = [...new Set(testRows.map((x) => x.region))];
for (const g of regions) {
  const l = testRows.filter((x) => x.region === g);
  out.byRegion[g] = { today: score(l, fires(TODAY)), chosen: score(l, fires(chosen)), wrongPer1000: statDiff(l, fires(chosen), fires(TODAY), 'wrongPer1000'), recall: statDiff(l, fires(chosen), fires(TODAY), 'recall') };
}
for (const id of [...new Set(testRows.map((x) => x.id))]) { const l = testRows.filter((x) => x.id === id); out.byStation[id] = { today: score(l, fires(TODAY)), chosen: score(l, fires(chosen)) }; }
// what the airport reported when each detector said fog (test weeks)
for (const [name, fn] of [['today', fires(TODAY)], ['chosen', fires(chosen)]]) {
  const t = {}; for (const x of testRows) if (fn(x)) t[x.truth] = (t[x.truth] || 0) + 1; out.instead[name] = t;
}
// Open-Meteo's low cloud as a diagnostic (reported, not tuned): its mean when the detector fired, fog vs not
out.lowCloudDiagnostic = Object.fromEntries(['fog', 'mist', 'low-cloud', 'other'].map((k) => [k, mean(testRows.filter((x) => fires(TODAY)(x) && x.truth === k).map((x) => x.low))]));

mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v3-fog.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));

const pc = (x) => (isNum(x) ? `${(x * 100).toFixed(0)}%` : '—');
const ci = (b, m = 1, d = 3) => (b && isNum(b.lo) ? `${(b.diff * m).toFixed(d)} [${(b.lo * m).toFixed(d)}, ${(b.hi * m).toFixed(d)}]` : b ? `${(b.diff * m).toFixed(d)} [—]` : '—');
console.log(`FOG detector — ${rows.length} station-hours (${tuneRows.length} tune, ${testRows.length} test), ${FROM} → ${TO}`);
console.log('Top tune cells (F0.5):'); for (const t of tuned.slice(0, 6)) console.log(`  rh≥${t.c.rh} spread≤${t.c.spread} wind≤${t.c.wind ?? '—'}: F0.5 ${t.s.f05.toFixed(3)} P ${pc(t.s.precision)} R ${pc(t.s.recall)} calls ${t.s.calls}`);
const tt = tuned.find((t) => t.c.rh === 90 && t.c.spread === 2 && t.c.wind === null); console.log(`  (today on tune weeks: F0.5 ${tt.s.f05.toFixed(3)} P ${pc(tt.s.precision)} R ${pc(tt.s.recall)} calls ${tt.s.calls})`);
console.log(`CHOSEN: rh≥${chosen.rh} spread≤${chosen.spread} wind≤${chosen.wind ?? '—'}`);
const T = out.test;
console.log(`TEST today : fog hours ${T.today.fogHours}, calls ${T.today.calls}, right ${T.today.hits} (P ${pc(T.today.precision)}), caught ${pc(T.today.recall)}, F0.5 ${T.today.f05.toFixed(3)}, wrong/1000h ${T.today.wrongPer1000.toFixed(1)}`);
console.log(`TEST chosen: fog hours ${T.chosen.fogHours}, calls ${T.chosen.calls}, right ${T.chosen.hits} (P ${pc(T.chosen.precision)}), caught ${pc(T.chosen.recall)}, F0.5 ${T.chosen.f05.toFixed(3)}, wrong/1000h ${T.chosen.wrongPer1000.toFixed(1)}`);
console.log(`  precision diff ${ci(T.precision)} · F0.5 diff ${ci(T.f05)} · wrong/1000h diff ${ci(T.wrongPer1000, 1, 1)} · recall diff ${ci(T.recall)}`);
console.log('By region (test): wrong/1000h today → chosen [diff CI] · caught today → chosen');
for (const [g, r] of Object.entries(out.byRegion)) console.log(`  ${g.padEnd(14)} ${r.today.wrongPer1000.toFixed(1)} → ${r.chosen.wrongPer1000.toFixed(1)} ${ci(r.wrongPer1000, 1, 1)} · caught ${r.today.hits}/${r.today.fogHours} → ${r.chosen.hits}/${r.chosen.fogHours} · P ${pc(r.today.precision)} → ${pc(r.chosen.precision)}`);
console.log('What the airport reported when the detector said fog (test):', JSON.stringify(out.instead));
console.log('Open-Meteo low cloud when today\'s detector fired, by what it was (test):', JSON.stringify(out.lowCloudDiagnostic));
