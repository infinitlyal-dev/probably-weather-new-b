// v8 §3: the Western Cape's false Windy — Cape Town airport's report as a veto (family A) or a higher line (family B),
// scored at the WC SAWS stations outside Strand's zone (PLAN §3 with §6 changes 2–4). Committed before it is run.
//   node review/accuracy/v8/wc.mjs   → v8/results-wc.json + results-wc.txt
// Rows as review/accuracy/stations/score.mjs builds them (instants HH:30, truth = the station's next report, weight 1/k,
// FACT's METAR usable 10 min after its time, M replayed through api/_lib at the station, three source guesses).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSynop } from '../v7/synop7.mjs';
import { DATA as V7DATA } from '../v7/common.mjs';
import { VARIANTS, productionWeights } from '../v2/temps-replay.mjs';
import { isNum, round } from '../v2/lib.mjs';
import { shapeWind, windLine } from '../../../api/_lib/wind.js';
import { gustRuleAt, gustFactorAt } from '../../../api/_lib/gusts.js';
import { GUST_TABLE } from '../../../api/_lib/gust-table.js';
import { regionOf } from '../../../api/_lib/regions.js';
import { scoredStations } from '../stations/stations.mjs';
import { kmBetween } from '../stations/geo.mjs';
import { isPumping, isCalm } from '../stations/pairs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FACT = { id: 'FACT', lat: -33.967, lon: 18.6 };
const STRAND = { lat: -34.1408, lon: 18.8483 };
const FACT_SITE = new Set(['68816', '68999']);          // Cape Town airport's own SYNOP records — §6 change 2
const L_METAR = 10 * 60e3, WINDOW = { 1: 90 * 60e3, 3: 3.5 * 3600e3, 6: 6.5 * 3600e3 };
const START = Date.UTC(2026, 2, 1) - 2 * 3600e3, PROOF_FROM = Date.UTC(2026, 6, 1) - 2 * 3600e3, END = Date.UTC(2026, 8, 28, 12, 0);
const GUESSES = [
  { name: 'old harness', mean: VARIANTS['old harness'], gust: ['best_match', 'ecmwf_ifs025', 'gfs_seamless'] },
  { name: 'ECMWF-heavy', mean: VARIANTS['ECMWF-heavy'], gust: ['best_match', 'ecmwf_ifs025', 'ecmwf_ifs025'] },
  { name: 'mixed', mean: VARIANTS.mixed, gust: ['best_match', 'best_match', 'gfs_seamless'] },
];
const GUST_SCALE = JSON.parse(readFileSync(path.join(here, '../v7/results-score7.json'), 'utf8')).fidelity?.gustScale ?? 1;
const G3 = [0, 1, 2], avg = (f) => G3.reduce((s, gi) => s + f(gi), 0) / 3;
const sastKey = (ms) => new Date(ms + 2 * 3600e3).toISOString().slice(0, 13);
const maxOf = (a) => { const v = a.filter(isNum); return v.length ? Math.max(...v) : null; };
const A_GRID = []; for (const m of [15, 20, 25]) for (const g of [35, 45]) for (const F of [1.5, 3]) for (const R of [30, 60, 200]) A_GRID.push({ m, g, F, R });
const B_GRID = [30, 32.5, 35, 37.5].map((X) => ({ X }));
const out = { plan: 'review/accuracy/v8/PLAN.md §3, §6.2–4', factSiteExcluded: [...FACT_SITE] };

// ---------------- stations and reports ----------------
const synop = loadSynop();
const all = scoredStations(synop);
const wcRest = all.filter((s) => s.kind === 'synop' && regionOf(s.lat, s.lon) === 'Western Cape' && !FACT_SITE.has(s.id)
  && kmBetween(s.lat, s.lon, STRAND.lat, STRAND.lon) > 15 && existsSync(path.join(V7DATA, `om-${s.id}.json`)));
const reportsOf = (s) => [...synop.get(s.id).values()].map((r) => ({ t: r.utc, mean: r.kph, gust: r.gustKph })).sort((a, b) => a.t - b.t);
function metarReports(id) {
  const lines = readFileSync(path.join(V7DATA, `metar-${id}.csv`), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  const H = lines[0].split(','), ix = (k) => H.indexOf(k), res = [];
  for (const l of lines.slice(1)) {
    const c = l.split(','); if (c.length < H.length) continue;
    const n = (k) => { const v = c[ix(k)]; return v === 'M' || v === '' || v === undefined ? null : Number(v); };
    const t = Date.parse(c[ix('valid')].replace(' ', 'T') + 'Z'); const sk = n('sknt');
    if (Number.isFinite(t) && sk !== null) res.push({ t, mean: sk * 1.852, gust: n('gust') === null ? null : n('gust') * 1.852 });
  }
  return res.sort((a, b) => a.t - b.t);
}
const factReps = metarReports('FACT');
function lastUsable(reps, tau, maxAgeMs) {
  let lo = 0, hi = reps.length - 1, best = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (reps[mid].t + L_METAR <= tau) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  return best >= 0 && tau - reps[best].t <= maxAgeMs ? reps[best] : null;
}

// ---------------- the models at a station: what M's rung needs, per SAST hour, per guess ----------------
function modelAt(s) {
  const j = JSON.parse(readFileSync(path.join(V7DATA, `om-${s.id}.json`), 'utf8'));
  const jb = JSON.parse(readFileSync(path.join(V7DATA, `omb-${s.id}.json`), 'utf8'));
  const H = { ...j.hourly, ...jb.hourly }, highs = {};
  const models = [...new Set(GUESSES.flatMap((g) => [...g.mean, ...g.gust]))];
  for (let i = 0; i < H.time.length; i++) for (const mo of models) { const tt = H[`temperature_2m_${mo}`]?.[i]; if (isNum(tt)) { const k = `${mo}|${H.time[i].slice(0, 10)}`; highs[k] = Math.max(highs[k] ?? -99, tt); } }
  const rule = gustRuleAt(s.lat, s.lon), m = new Map();
  for (let i = 0; i < H.time.length; i++) {
    const key = H.time[i].slice(0, 13), day = key.slice(0, 10), month = Number(day.slice(5, 7)), hour = Number(key.slice(11, 13));
    const corr = gustFactorAt(s.lat, s.lon, H.wind_direction_10m_best_match?.[i]);
    const headF = corr.factor !== 1 && GUST_TABLE.stations.find((x) => x.id === corr.station)?.headline !== false ? corr.factor : 1;
    m.set(key, GUESSES.map((g) => {
      const slots = g.mean.map((mo) => { const v = H[`wind_speed_10m_${mo}`]?.[i]; return isNum(v) ? v : null; });
      if (!isNum(slots[0])) return null;
      const { W } = productionWeights(g.mean.map((mo) => highs[`${mo}|${day}`] ?? null), s.lat, s.lon);
      let sw = 0, ws = 0; slots.forEach((v, k) => { if (isNum(v) && W[k] > 0) { sw += v * W[k]; ws += W[k]; } });
      const raw = ws ? Math.round((sw / ws) * 10) / 10 : null;
      const line = windLine(shapeWind({ raw, values: slots.filter(isNum), slots, kind: 'now', lat: s.lat, lon: s.lon, month, hour }));
      const cg = g.gust.map((mo) => { const v = H[`wind_gusts_10m_${mo}`]?.[i]; return isNum(v) ? v * GUST_SCALE * headF : null; });
      return { slots, cg, line, G: rule.gustLineKph, K: rule.sourcesAt25 };
    }));
  }
  return m;
}
/** production's hero Windy rung + B-2 consensus with the mean line T (null = the place's own line) */
function windyAt(x, T = null) {
  const L = x.line, line = T ?? L.thresholdKph, heroGust = maxOf(x.cg);
  let fire = (isNum(L.kph) && L.kph >= line) || (isNum(heroGust) && heroGust >= x.G) || (x.K > 0 && x.slots.filter((v) => isNum(v) && v >= 25).length >= x.K);
  if (fire && x.slots.filter(isNum).length >= 3) {
    let sup = 0;
    x.slots.forEach((w, k) => { const gg = k < 3 ? x.cg[k] : null; if ((isNum(w) && w * L.sourceFactor >= line * 0.8) || (isNum(gg) && gg >= x.G * 0.8)) sup++; });
    if (sup < 2) fire = false;
  }
  return fire;
}

// ---------------- rows ----------------
const rows = [];
for (const s of wcRest) {
  const model = modelAt(s), reps = reportsOf(s), dFact = kmBetween(s.lat, s.lon, FACT.lat, FACT.lon);
  let prevT = null;
  for (const T of reps) {
    if (T.t < START || T.t > END) { prevT = T.t; continue; }
    const from = prevT ?? T.t - WINDOW[s.cadence]; prevT = T.t;
    const inst = [];
    for (let tau = Math.ceil((from - 30 * 60e3) / 3600e3) * 3600e3 + 30 * 60e3; tau <= T.t; tau += 3600e3) if (tau > from && T.t - tau <= WINDOW[s.cadence] && tau >= START) inst.push(tau);
    if (!inst.length) continue;
    for (const tau of inst) {
      const mNow = model.get(sastKey(Math.floor(tau / 3600e3) * 3600e3)); if (!mNow || mNow.some((x) => !x)) continue;
      const r = lastUsable(factReps, tau, 3 * 3600e3);
      rows.push({ id: s.id, tT: T.t, tau, w: 1 / inst.length, proof: tau >= PROOF_FROM, week: Math.floor((tau - START) / (7 * 864e5)), day: sastKey(tau).slice(0, 10), dFact,
        pumping: isPumping(T), calm: isCalm(T), fact: r ? { age: (tau - r.t) / 3600e3, mean: r.mean, gust: r.gust } : null,
        x: mNow, M: mNow.map((x) => windyAt(x)) });
    }
  }
}
out.rows = { n: rows.length, stations: wcRest.map((s) => ({ id: s.id, name: s.name, kmToFact: round(kmBetween(s.lat, s.lon, FACT.lat, FACT.lon), 1), cadence: s.cadence })) };

// ---------------- the rules ----------------
const vetoed = (r, P) => Boolean(r.fact && r.fact.age <= P.F && r.dFact <= P.R && r.fact.mean < P.m && (!isNum(r.fact.gust) || r.fact.gust < P.g));
const decide = (fam, r, gi, P) => (fam === 'M' ? r.M[gi] : fam === 'A' ? r.M[gi] && !vetoed(r, P) : windyAt(r.x[gi], r.x[gi].line.thresholdKph === 27.5 ? P.X : null));
function tally(R, fam, gi, P) {
  let pw = 0, pc = 0, cw = 0, cf = 0;
  for (const r of R) { if (r.pumping) { pw += r.w; if (decide(fam, r, gi, P)) pc += r.w; } else if (r.calm) { cw += r.w; if (decide(fam, r, gi, P)) cf += r.w; } }
  return { pumping: pw, caught: pw ? pc / pw : null, calm: cw, falsePer100: cw ? (100 * cf) / cw : null, caughtW: pc, falseW: cf };
}
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
function boot(R, fam, gi, P) {
  const agg = new Map();
  for (const r of R) {
    const a = agg.get(r.week) || agg.set(r.week, [0, 0, 0, 0, 0, 0]).get(r.week);
    if (r.pumping) { a[0] += r.w; if (decide(fam, r, gi, P)) a[1] += r.w; if (r.M[gi]) a[2] += r.w; }
    else if (r.calm) { a[3] += r.w; if (decide(fam, r, gi, P)) a[4] += r.w; if (r.M[gi]) a[5] += r.w; }
  }
  const weeks = [...agg.values()];
  const stat = (ws) => { const t = [0, 0, 0, 0, 0, 0]; for (const w of ws) for (let i = 0; i < 6; i++) t[i] += w[i]; return [t[0] ? (t[1] - t[2]) / t[0] : null, t[3] ? (100 * (t[4] - t[5])) / t[3] : null]; };
  let s = 7 >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const point = stat(weeks), c = [], f = [];
  for (let k = 0; k < 1000; k++) { const pk = []; for (let i = 0; i < weeks.length; i++) pk.push(weeks[Math.floor(rnd() * weeks.length)]); const [x, y] = stat(pk); if (isNum(x)) c.push(x); if (isNum(y)) f.push(y); }
  c.sort((a, b) => a - b); f.sort((a, b) => a - b);
  return { caught: { d: point[0], lo: q(c, 0.025), hi: q(c, 0.975) }, false: { d: point[1], lo: q(f, 0.025), hi: q(f, 0.975) } };
}

// ---------------- tune (March–June) ----------------
const tune = rows.filter((r) => !r.proof), proof = rows.filter((r) => r.proof);
const mT = { caught: avg((gi) => tally(tune, 'M', gi, {}).caught), false: avg((gi) => tally(tune, 'M', gi, {}).falsePer100) };
const pick = (fam, grid, vetoesLess) => {
  const cand = grid.map((P) => ({ P, caught: avg((gi) => tally(tune, fam, gi, P).caught), false: avg((gi) => tally(tune, fam, gi, P).falsePer100) }))
    .filter((c) => c.caught >= mT.caught - 0.02);
  cand.sort((a, b) => a.false - b.false || vetoesLess(a.P, b.P));
  return cand[0] ?? null;
};
const lessA = (a, b) => a.m - b.m || a.g - b.g || a.F - b.F || a.R - b.R;
const tA = pick('A', A_GRID, lessA), tB = pick('B', B_GRID, (a, b) => a.X - b.X);
const fam = !tA ? (tB ? 'B' : null) : !tB ? 'A' : tA.false <= tB.false ? 'A' : 'B';
const chosen = fam === 'A' ? tA : fam === 'B' ? tB : null;
out.tune = { M: mT, A: tA, B: tB, family: fam };

// ---------------- prove ----------------
function bars(R, P) {
  const per = G3.map((gi) => ({ guess: GUESSES[gi].name, M: tally(R, 'M', gi, P), R: tally(R, fam, gi, P), boot: boot(R, fam, gi, P) }));
  const b1 = per.every((x) => isNum(x.boot.false.d) && x.boot.false.d <= -3 && isNum(x.boot.false.hi) && x.boot.false.hi < 0);
  const b2 = per.every((x) => isNum(x.boot.caught.d) && x.boot.caught.d >= -0.02 && isNum(x.boot.caught.lo) && x.boot.caught.lo >= -0.05);
  const pumpReports = new Set(R.filter((r) => r.pumping).map((r) => `${r.id}|${r.tT}`)).size, pumpDays = new Set(R.filter((r) => r.pumping).map((r) => r.day)).size;
  return { per, pumpReports, pumpDays, b1, b2, b3: pumpReports >= 30 && pumpDays >= 6 };
}
if (chosen) {
  const P = chosen.P, main = bars(proof, P);
  // §6.3: per station — none with ≥ 30 pumping proof hours loses > 5 points (all guesses)
  const perStation = wcRest.map((s) => {
    const R = proof.filter((r) => r.id === s.id);
    const pumpH = R.filter((r) => r.pumping).reduce((a, r) => a + r.w, 0);
    const g = G3.map((gi) => { const m = tally(R, 'M', gi, P), x = tally(R, fam, gi, P); return { caughtM: m.caught, caughtR: x.caught, falseM: m.falsePer100, falseR: x.falsePer100 }; });
    const loss = Math.max(...g.map((x) => (isNum(x.caughtM) && isNum(x.caughtR) ? x.caughtM - x.caughtR : 0)));
    return { id: s.id, name: s.name, pumpingHours: round(pumpH, 1), calmHours: round(R.filter((r) => r.calm).reduce((a, r) => a + r.w, 0), 1), maxCaughtLoss: round(loss, 3), guesses: g, breach: pumpH >= 30 && loss > 0.05 };
  });
  const topPump = [...perStation].sort((a, b) => b.pumpingHours - a.pumpingHours)[0]?.id;
  const falseUnderM = wcRest.map((s) => ({ id: s.id, f: avg((gi) => tally(proof.filter((r) => r.id === s.id), 'M', gi, P).falseW) })).sort((a, b) => b.f - a.f)[0]?.id;
  const looPump = bars(proof.filter((r) => r.id !== topPump), P), looFalse = bars(proof.filter((r) => r.id !== falseUnderM), P);
  const passLoo = (b) => b.b1 && b.b2 && b.b3;
  const price = G3.map((gi) => { const m = tally(proof, 'M', gi, P), x = tally(proof, fam, gi, P); return { pumpingHoursLost: round(m.caughtW - x.caughtW, 1), falseCallsSaved: round(m.falseW - x.falseW, 1) }; });
  out.proof = { P, main, perStation, leaveOut: { topPumping: topPump, passesWithout: passLoo(looPump), topFalseUnderM: falseUnderM, passesWithoutFalse: passLoo(looFalse) }, price };
  out.ships = main.b1 && main.b2 && main.b3 && !perStation.some((x) => x.breach) && passLoo(looPump) && passLoo(looFalse);
} else out.ships = false;

writeFileSync(path.join(here, 'results-wc.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? round(v, 4) : v), 1));
const pc = (x) => (isNum(x) ? `${(x * 100).toFixed(1)}%` : '—');
const L = [];
L.push(`WC-rest: ${wcRest.length} stations, ${rows.length} instants; tune M caught ${pc(mT.caught)} false ${mT.false.toFixed(2)}/100 calm`);
L.push(`  A best: ${tA ? `${JSON.stringify(tA.P)} caught ${pc(tA.caught)} false ${tA.false.toFixed(2)}` : 'none within 2 points'}; B best: ${tB ? `${JSON.stringify(tB.P)} caught ${pc(tB.caught)} false ${tB.false.toFixed(2)}` : 'none'} → ${fam ?? 'nothing'} to proof`);
if (out.proof) {
  const p = out.proof;
  for (const x of p.main.per) L.push(`  ${x.guess}: caught ${pc(x.M.caught)} → ${pc(x.R.caught)} Δ${(x.boot.caught.d * 100).toFixed(1)} [${(x.boot.caught.lo * 100).toFixed(1)}, ${(x.boot.caught.hi * 100).toFixed(1)}]; false ${x.M.falsePer100.toFixed(2)} → ${x.R.falsePer100.toFixed(2)} Δ${x.boot.false.d.toFixed(2)} [${x.boot.false.lo.toFixed(2)}, ${x.boot.false.hi.toFixed(2)}]`);
  L.push(`  bars 1 ${p.main.b1} 2 ${p.main.b2} 3 ${p.main.b3} (${p.main.pumpReports} pumping reports on ${p.main.pumpDays} days); per-station breach ${p.perStation.filter((x) => x.breach).map((x) => x.id).join(' ') || 'none'}; without ${p.leaveOut.topPumping} ${p.leaveOut.passesWithout}; without ${p.leaveOut.topFalseUnderM} ${p.leaveOut.passesWithoutFalse}`);
  L.push(`  price: ${p.price.map((x) => `${x.pumpingHoursLost} pumping hours lost, ${x.falseCallsSaved} false calls saved`).join(' | ')}`);
  for (const s of p.perStation) L.push(`    ${s.id} ${s.name}: pumping ${s.pumpingHours} h, calm ${s.calmHours} h; caught ${s.guesses.map((g) => `${pc(g.caughtM)}→${pc(g.caughtR)}`).join(' ')}; false ${s.guesses.map((g) => `${g.falseM?.toFixed(1)}→${g.falseR?.toFixed(1)}`).join(' ')}`);
}
L.push(`WESTERN CAPE: ${out.ships ? 'SHIPS' : 'does not ship'}`);
writeFileSync(path.join(here, 'results-wc.txt'), L.join('\n') + '\n');
console.log(L.join('\n'));
