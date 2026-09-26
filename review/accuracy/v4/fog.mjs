// FOG, THE PROPER FIX — stop trusting Open-Meteo's visibility (review/accuracy/v4/PLAN.md §1, pre-registered
// c639248, with Fable's changes). Candidate "saturated at the ground": no rain (best_match), at least k of the five
// models production can read (best_match, GFS, ICON, UK Met Office, Météo-France) with spread ≤ s °C and low cloud
// ≥ L %, best_match wind ≤ W km/h. Open-Meteo's visibility is not an input. 1 Oct 2025 → 24 Sept 2026, noon-to-noon
// days, even ISO weeks tune, odd weeks test; the cell must fire in Strand's 21 May fog window on the archived inputs
// (3 Aug reported, not a constraint — Fable); F0.5 on the tune weeks picks it; tested once, per region, against
// today's rule and the live one; a region needs >= 10 fog hours in the test weeks and keeps more than half of the
// live rule's caught fog hours (Fable's recall floor).
//   node review/accuracy/v4/fog.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadObs, days, hourKey, isNum, round, RESULTS } from '../v2/lib.mjs';
import { fogTruth, isoWeek } from '../v3/lib3.mjs';
import { FOG_MODELS, FOG_STATIONS, STRAND } from './fetch4.mjs';
import { loadFog, rhOf, bootStat } from './lib4.mjs';
import { FOG_STRICT_REGIONS } from '../../../api/weather.js';

const FROM = '2025-10-01', TO = '2026-09-24';
const nightOf = (day, h) => (h >= 12 ? day : new Date(Date.parse(`${day}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10));
const weekOf = (d) => { const w = isoWeek(d); return `${w.year}-W${w.week}`; };
const tune = (d) => isoWeek(d).week % 2 === 0;

// ---- one row per station-hour with truth ----
function signals(row) {
  const bm = row.best_match;
  const sat = {};
  for (const m of FOG_MODELS) { const x = row[m]; sat[m] = isNum(x?.t) && isNum(x?.d) ? { spread: x.t - x.d, low: x.low } : null; }
  return { vis: bm.vis, rh: rhOf(bm.t, bm.d), spread: isNum(bm.t) && isNum(bm.d) ? bm.t - bm.d : null, pp: bm.pp, mm: bm.mm, wind: bm.w, sat,
    codes: FOG_MODELS.map((m) => row[m]?.code).filter(isNum) };
}
const rows = [];
for (const st of FOG_STATIONS) {
  const obs = loadObs(st.id), fog = loadFog(st.id);
  for (const d of days(FROM, TO)) for (let h = 0; h < 24; h++) {
    const k = hourKey(d, h), truth = fogTruth(obs.get(k));
    if (!truth) continue;
    const row = fog.get(k);
    if (!row || !isNum(row.best_match?.t)) continue;
    const night = nightOf(d, h);
    if (night < FROM) continue;
    rows.push({ id: st.id, region: st.region, day: d, h, night, week: weekOf(night), tune: tune(night), truth, ...signals(row) });
  }
}

// ---- the rules ----
const noRain = (x) => (!isNum(x.pp) || x.pp < 30) && (!isNum(x.mm) || x.mm < 0.2);
const STANDARD = (x) => isNum(x.vis) && x.vis < 1500 && isNum(x.rh) && x.rh >= 90 && isNum(x.spread) && x.spread <= 2 && noRain(x);
const STRICT = (x) => STANDARD(x) && x.rh >= 95 && isNum(x.wind) && x.wind <= 10;
const LIVE = (x) => (FOG_STRICT_REGIONS.includes(x.region) ? STRICT(x) : STANDARD(x));
// Input parity (Fable 3): a model the archive lacks (dew point or low cloud in under half the rows) is dropped from
// the count, and would be from production; a model missing the hour counts as not saturated.
const coverage = Object.fromEntries(FOG_MODELS.map((m) => [m, rows.filter((x) => x.sat[m] && isNum(x.sat[m].low)).length / (rows.length || 1)]));
const MODELS = FOG_MODELS.filter((m) => coverage[m] >= 0.5);
const saturatedCount = (x, c) => MODELS.filter((m) => { const s = x.sat[m]; return s && s.spread <= c.s && (c.L === 0 || (isNum(s.low) && s.low >= c.L)); }).length;
// best_match missing any of its own inputs (temperature, dew point, wind) -> the region's live rule (Fable 3)
const bmComplete = (x) => isNum(x.spread) && isNum(x.wind);
const NEW = (c) => (x) => (!bmComplete(x) ? LIVE(x) : noRain(x) && (c.W === null || x.wind <= c.W) && saturatedCount(x, c) >= c.k);
const GRID = [];
for (const k of [1, 2, 3]) for (const s of [0.5, 1.0, 1.5]) for (const L of [0, 50, 80]) for (const W of [null, 10, 15]) GRID.push({ k, s, L, W });

// ---- Strand's real fogs on the archived inputs (hard constraint) ----
const strand = loadFog(STRAND.id);
const WINDOWS = {
  '21 May 21:00 → 22 May 01:59': [...[21, 22, 23].map((h) => hourKey('2026-05-21', h)), ...[0, 1].map((h) => hourKey('2026-05-22', h))],
  '3 Aug 16:00 → 17:59': [16, 17].map((h) => hourKey('2026-08-03', h)),
};
const strandFires = (fn) => Object.fromEntries(Object.entries(WINDOWS).map(([w, ks]) => [w, ks.filter((k) => strand.get(k) && fn(signals(strand.get(k)))).map((k) => k.slice(11))]));
const qualifies = (fires) => fires['21 May 21:00 → 22 May 01:59'].length > 0;   // 3 Aug reported only (Fable 1)

const score = (list, fn) => {
  let hits = 0, fa = 0, miss = 0;
  for (const x of list) { const f = fn(x), t = x.truth === 'fog'; if (f && t) hits++; else if (f) fa++; else if (t) miss++; }
  const P = hits + fa ? hits / (hits + fa) : null, R = hits + miss ? hits / (hits + miss) : null;
  const f05 = P && R ? (1.25 * P * R) / (0.25 * P + R) : 0;
  return { n: list.length, fogHours: hits + miss, calls: hits + fa, hits, falseAlarms: fa, precision: P, recall: R, f05, wrongPer1000: list.length ? (fa / list.length) * 1000 : null };
};
const stat = (fn, key) => (list) => score(list, fn)[key];

// ---- tune ----
const tuneRows = rows.filter((x) => x.tune), testRows = rows.filter((x) => !x.tune);
const withStrand = GRID.map((c) => ({ c, strand: strandFires(NEW(c)) }));
const pool = withStrand.filter((g) => qualifies(g.strand));
const tuned = pool.map((g) => ({ ...g, s: score(tuneRows, NEW(g.c)) })).sort((a, b) => b.s.f05 - a.s.f05);
const chosen = tuned[0].c, CH = NEW(chosen);

// ---- test ----
const out = { period: { from: FROM, to: TO }, rows: rows.length, tuneRows: tuneRows.length, testRows: testRows.length,
  modelsCounted: MODELS, coverage, gridQualifying: pool.length, strandConstraint: '21 May (hard); 3 Aug reported',
  cellsFiringOn3Aug: withStrand.filter((g) => g.strand['3 Aug 16:00 → 17:59'].length).map((g) => g.c),
  strandFires: { chosen: strandFires(CH), standard: strandFires(STANDARD), strict: strandFires(STRICT) },
  chosen, tuneTop: tuned.slice(0, 10).map((t) => ({ ...t.c, f05: t.s.f05, precision: t.s.precision, recall: t.s.recall, calls: t.s.calls })),
  test: {}, byRegion: {}, byStation: {}, instead: {}, ships: [] };
out.test = {
  standard: score(testRows, STANDARD), live: score(testRows, LIVE), chosen: score(testRows, CH),
  f05VsLive: bootStat(testRows, stat(CH, 'f05'), stat(LIVE, 'f05')), f05VsStandard: bootStat(testRows, stat(CH, 'f05'), stat(STANDARD, 'f05')),
  precisionVsLive: bootStat(testRows, stat(CH, 'precision'), stat(LIVE, 'precision')),
  wrongVsLive: bootStat(testRows, stat(CH, 'wrongPer1000'), stat(LIVE, 'wrongPer1000')),
  recallVsLive: bootStat(testRows, stat(CH, 'recall'), stat(LIVE, 'recall')),
};
const pooledPass = isNum(out.test.f05VsLive?.lo) && out.test.f05VsLive.lo > 0;
out.pooledPass = pooledPass;
for (const g of [...new Set(testRows.map((x) => x.region))]) {
  const l = testRows.filter((x) => x.region === g);
  const r = { liveRule: FOG_STRICT_REGIONS.includes(g) ? 'strict' : 'standard', standard: score(l, STANDARD), live: score(l, LIVE), chosen: score(l, CH),
    wrongVsLive: bootStat(l, stat(CH, 'wrongPer1000'), stat(LIVE, 'wrongPer1000')), wrongVsStandard: bootStat(l, stat(CH, 'wrongPer1000'), stat(STANDARD, 'wrongPer1000')),
    recallVsLive: bootStat(l, stat(CH, 'recall'), stat(LIVE, 'recall')) };
  r.recallFloor = r.live.fogHours >= 10 && r.chosen.hits * 2 >= r.live.hits;   // Fable 2: >= 10 fog hours, keeps at least half of the caught ones
  r.passes = pooledPass && isNum(r.wrongVsLive?.hi) && r.wrongVsLive.hi < 0 && r.chosen.f05 >= r.live.f05 && r.recallFloor;
  if (r.passes) out.ships.push(g);
  out.byRegion[g] = r;
}
for (const id of [...new Set(testRows.map((x) => x.id))]) { const l = testRows.filter((x) => x.id === id); out.byStation[id] = { live: score(l, LIVE), chosen: score(l, CH) }; }
for (const [name, fn] of [['standard', STANDARD], ['live', LIVE], ['chosen', CH]]) { const t = {}; for (const x of testRows) if (fn(x)) t[x.truth] = (t[x.truth] || 0) + 1; out.instead[name] = t; }
// the models' own fog codes (45/48), reported: how often any model sent one on test weeks, and what the airport saw
out.fogCodes = {}; for (const x of testRows) if (x.codes.some((c) => c === 45 || c === 48)) out.fogCodes[x.truth] = (out.fogCodes[x.truth] || 0) + 1;

mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v4-fog.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));

const pc = (x) => (isNum(x) ? `${(x * 100).toFixed(0)}%` : '—');
const ci = (b, d = 3) => (b && isNum(b.lo) ? `${b.diff.toFixed(d)} [${b.lo.toFixed(d)}, ${b.hi.toFixed(d)}]` : b ? `${b.diff?.toFixed(d)} [—]` : '—');
const line = (s) => `fog h ${s.fogHours}, calls ${s.calls}, right ${s.hits} (P ${pc(s.precision)}), caught ${pc(s.recall)}, F0.5 ${s.f05.toFixed(3)}, wrong/1000h ${s.wrongPer1000?.toFixed(1)}`;
console.log(`FOG v4 — ${rows.length} station-hours (${tuneRows.length} tune, ${testRows.length} test); models counted ${MODELS.join(', ')} (low-cloud coverage ${Object.entries(coverage).map(([m, v]) => `${m} ${(v * 100).toFixed(0)}%`).join(', ')}); ${pool.length} of ${GRID.length} cells fire on Strand 21 May; ${out.cellsFiringOn3Aug.length} on 3 Aug`);
console.log('Top tune cells:'); for (const t of tuned.slice(0, 6)) console.log(`  k≥${t.c.k} spread≤${t.c.s} low≥${t.c.L} wind≤${t.c.W ?? '—'}: F0.5 ${t.s.f05.toFixed(3)} P ${pc(t.s.precision)} R ${pc(t.s.recall)} calls ${t.s.calls}`);
console.log(`CHOSEN k≥${chosen.k} spread≤${chosen.s} low≥${chosen.L} wind≤${chosen.W ?? '—'} · Strand fires ${JSON.stringify(out.strandFires.chosen)} (standard ${JSON.stringify(out.strandFires.standard)}, strict ${JSON.stringify(out.strandFires.strict)})`);
console.log(`TEST standard: ${line(out.test.standard)}`);
console.log(`TEST live    : ${line(out.test.live)}`);
console.log(`TEST chosen  : ${line(out.test.chosen)}`);
console.log(`  vs live: F0.5 ${ci(out.test.f05VsLive)} · precision ${ci(out.test.precisionVsLive)} · wrong/1000h ${ci(out.test.wrongVsLive, 1)} · caught ${ci(out.test.recallVsLive)} → pooled ${pooledPass ? 'PASS' : 'FAIL'}`);
console.log('By region (test): live rule · wrong/1000h live → chosen [diff] · caught live → chosen · F0.5 live → chosen · ships');
for (const [g, r] of Object.entries(out.byRegion)) console.log(`  ${g.padEnd(14)} ${r.liveRule.padEnd(8)} ${r.live.wrongPer1000.toFixed(1)} → ${r.chosen.wrongPer1000.toFixed(1)} ${ci(r.wrongVsLive, 1)} · caught ${r.live.hits}/${r.live.fogHours} → ${r.chosen.hits}/${r.chosen.fogHours} · F0.5 ${r.live.f05.toFixed(3)} → ${r.chosen.f05.toFixed(3)} · floor ${r.recallFloor ? 'ok' : 'NO'} · ${r.passes ? 'SHIP' : 'keep'}`);
console.log('What the airport reported when each rule said fog (test):', JSON.stringify(out.instead));
console.log('Any model sent a fog code (test weeks), by what the airport saw:', JSON.stringify(out.fogCodes));
console.log(`SHIPS IN: ${out.ships.join(', ') || 'none'}`);
