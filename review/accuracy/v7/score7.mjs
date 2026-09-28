// v7 scorer — gusts and the Windy headline (PLAN.md, with Fable's nine changes §8). Committed before it is run.
//   node review/accuracy/v7/score7.mjs            → v7/results-score7.json + v7/results-score7.md
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA } from './fetch7.mjs';
import { loadSynop, gustStationsFromDisk, sastKey } from './synop7.mjs';
import { STATIONS } from '../v2/stations.mjs';
import { VARIANTS, productionWeights } from '../v2/temps-replay.mjs';
import { loadStationHourly } from '../lib/obs.mjs';
import { bootDiff, isNum, mean, round } from '../v2/lib.mjs';
import { shapeWind, windLine } from '../../../api/_lib/wind.js';
import { regionOf } from '../../../api/_lib/regions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const LIVE = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const GUST_LINE_TODAY = 55;                       // api/weather.js WIND_NOW_GUST_KPH
const PUMP_GUST = 50, PUMP_MEAN = 30, CALM_MEAN = 20, CALM_GUST = 35;
const TUNE_TO = '2026-06-30', PROOF_FROM = '2026-07-01';
const G_OPTIONS = [40, 45, 50, 55, 60], K_OPTIONS = [2, 3];
const TUNE_BUDGET = 1.0, PROOF_BUDGET = 1.5, PROOF_BUDGET_HI = 3, CATCH_FLOOR = 5;
const GUESSES = [
  { name: 'old harness', mean: VARIANTS['old harness'], gust: ['best_match', 'ecmwf_ifs025', 'gfs_seamless'] },
  { name: 'ECMWF-heavy', mean: VARIANTS['ECMWF-heavy'], gust: ['best_match', 'ecmwf_ifs025', 'ecmwf_ifs025'] },
  { name: 'mixed', mean: VARIANTS.mixed, gust: ['best_match', 'best_match', 'gfs_seamless'] },
];
const STRAND = { lat: -34.1408, lon: 18.8483 };
const km = (aLat, aLon, bLat, bLon) => { const R = Math.PI / 180, dLat = (bLat - aLat) * R, dLon = (bLon - aLon) * R; const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.min(1, Math.sqrt(h))); };
const WEEK0 = Date.UTC(2026, 2, 2);               // Monday 2 March 2026 = ISO week 10: index parity = ISO week parity
const weekOf = (day) => Math.floor((Date.parse(`${day}T00:00:00Z`) - WEEK0) / (7 * 864e5));
const sectorOf = (d) => (isNum(d) ? Math.floor(((d + 22.5) % 360) / 45) : null);
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const maxOf = (a) => { const v = a.filter(isNum); return v.length ? Math.max(...v) : null; };
const out = { generatedAt: new Date().toISOString(), plan: 'review/accuracy/v7/PLAN.md', definitions: { pumping: `gust ≥ ${PUMP_GUST} or mean ≥ ${PUMP_MEAN}`, calm: `mean < ${CALM_MEAN} and gust (where sent) < ${CALM_GUST}` } };

// ---------- stations ----------
const synop = loadSynop();
const gustSt = gustStationsFromDisk(100).map((s) => ({ ...s, kind: 'synop', share910: s.gusts / s.reports }));
const airports = STATIONS.filter((a) => !a.skip).map((a) => ({ id: a.id, name: a.name, lat: a.lat, lon: a.lon, elev: a.elev, kind: 'metar' }))
  .filter((a) => !gustSt.some((s) => km(a.lat, a.lon, s.lat, s.lon) <= 3));
const all = [...gustSt, ...airports].filter((s) => existsSync(path.join(DATA, `om-${s.id}.json`)));
for (const s of all) { s.region = regionOf(s.lat, s.lon); s.strandZone = km(s.lat, s.lon, STRAND.lat, STRAND.lon) <= 15; s.gustStation = s.kind === 'synop' && s.share910 >= 0.8; }
out.stations = all.map((s) => ({ id: s.id, name: s.name, kind: s.kind, region: s.region, lat: s.lat, lon: s.lon, elev: s.elev, reports: s.reports ?? null, share910: s.share910 != null ? round(s.share910, 3) : null, gustStation: s.gustStation, strandZone: s.strandZone }));
out.dropped = { airportsColocated: STATIONS.filter((a) => !a.skip && !airports.some((b) => b.id === a.id)).map((a) => a.id), noModelFile: [...gustSt, ...airports].filter((s) => !existsSync(path.join(DATA, `om-${s.id}.json`))).map((s) => s.id) };

// ---------- the check before scoring: Strand 68911 this afternoon ----------
const s68911 = synop.get('68911');
const today12 = s68911?.get(Date.UTC(2026, 8, 28, 12));
const isPumping = (o) => (isNum(o.gust) && o.gust >= PUMP_GUST) || (isNum(o.mean) && o.mean >= PUMP_MEAN);
const isCalm = (o) => isNum(o.mean) && o.mean < CALM_MEAN && (!isNum(o.gust) || o.gust < CALM_GUST);
out.strandToday = today12 ? { utc: '2026-09-28T12Z', mean: round(today12.kph, 1), gust: round(today12.gustKph, 1), dir: today12.dir, pumping: isPumping({ mean: today12.kph, gust: today12.gustKph }) } : { missing: true };

// ---------- rows ----------
function loadOm(id) {
  const j = JSON.parse(readFileSync(path.join(DATA, `om-${id}.json`), 'utf8'));
  const H = j.hourly, m = new Map(), highs = {};
  const models = [...new Set(GUESSES.flatMap((g) => [...g.mean, ...g.gust]))];
  H.time.forEach((t, i) => {
    const rec = {};
    for (const mo of models) {
      const w = H[`wind_speed_10m_${mo}`]?.[i], g = H[`wind_gusts_10m_${mo}`]?.[i], d = H[`wind_direction_10m_${mo}`]?.[i], tt = H[`temperature_2m_${mo}`]?.[i];
      rec[mo] = { w: isNum(w) ? w : null, g: isNum(g) ? g : null, d: isNum(d) ? d : null };
      if (isNum(tt)) { const k = `${mo}|${t.slice(0, 10)}`; highs[k] = Math.max(highs[k] ?? -99, tt); }
    }
    m.set(t.slice(0, 13), rec);
  });
  return { m, highs, elevation: j.elevation };
}
const rows = [];
for (const s of all) {
  const om = loadOm(s.id); s.modelElevation = om.elevation;
  const truth = new Map();
  if (s.kind === 'synop') for (const r of synop.get(s.id).values()) truth.set(sastKey(r.utc), { mean: r.kph, gust: r.gustKph, dir: r.dir });
  else for (const [k, r] of loadStationHourly(path.join(DATA, `metar-${s.id}.csv`))) truth.set(k, { mean: r.windKph, gust: r.gustKph, dir: null });
  for (const [key, o] of truth) {
    const mrec = om.m.get(key); if (!mrec || !isNum(o.mean) || !isNum(mrec.best_match?.w)) continue;
    const day = key.slice(0, 10), h = Number(key.slice(11, 13));
    const row = { s, key, day, h, month: Number(day.slice(5, 7)), week: weekOf(day), o, pumping: isPumping(o), calm: isCalm(o), dirM: mrec.best_match.d, pre: [] };
    for (const g of GUESSES) {
      const slots = g.mean.map((mo) => mrec[mo]?.w ?? null);
      const highs = g.mean.map((mo) => om.highs[`${mo}|${day}`] ?? null);
      const { W } = productionWeights(highs, s.lat, s.lon);
      let sw = 0, ws = 0; slots.forEach((v, i) => { if (isNum(v) && W[i] > 0) { sw += v * W[i]; ws += W[i]; } });
      const raw = ws ? Math.round((sw / ws) * 10) / 10 : null;
      const shaped = shapeWind({ raw, values: slots.filter(isNum), slots, kind: 'now', lat: s.lat, lon: s.lon, month: row.month, hour: h });
      row.pre.push({ slots, line: windLine(shaped), gusts: g.gust.map((mo) => mrec[mo]?.g ?? null) });
    }
    rows.push(row);
  }
}
out.rows = { total: rows.length, pumping: rows.filter((r) => r.pumping).length, calm: rows.filter((r) => r.calm).length };

// ---------- Fable 4: replay fidelity against the recorder ----------
let gustScale = 1;
{
  const recs = existsSync(LIVE) ? readdirSync(LIVE).filter((f) => /^2026-09-\d\d\.jsonl$/.test(f)).flatMap((f) => readFileSync(path.join(LIVE, f), 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } })) : [];
  const rowAt = new Map(rows.map((x) => [`${x.s.id}|${x.key}`, x]));
  const pairs = [];
  const omCache = {};
  for (const r of recs) {
    const id = r?.spot === 'Strand' ? '68911' : r?.icao; const p = r?.api?.payload;
    if (!id || !p?.now || !existsSync(path.join(DATA, `om-${id}.json`))) continue;
    omCache[id] ??= loadOm(id).m;
    const key = sastKey(Date.parse(r.runAtUtc)); const mrec = omCache[id].get(key); if (!mrec) continue;
    const served = p.now.conditionSignals?.numeric?.gustKph;
    const row = rowAt.get(`${id}|${key}`);
    pairs.push({ id, served, archive: GUESSES.map((g) => maxOf(g.gust.map((mo) => mrec[mo]?.g))), servedWindy: p.now.conditionKey === 'wind', replayWindy: row ? GUESSES.map((_, gi) => windy(row, gi, {})) : null });
  }
  const both = pairs.filter((x) => isNum(x.served) && x.archive.every(isNum));
  const ratio = GUESSES.map((g, gi) => { const a = mean(both.map((x) => x.archive[gi])), s = mean(both.map((x) => x.served)); return isNum(a) && a > 0 ? s / a : null; });
  const avgRatio = mean(ratio);
  if (isNum(avgRatio) && avgRatio < 0.9) gustScale = avgRatio;
  out.fidelity = { recorderReadings: pairs.length, withGusts: both.length, servedOverArchive: ratio.map((x) => round(x, 3)), gustScale: round(gustScale, 3),
    servedMeanGust: round(mean(both.map((x) => x.served)), 1), archiveMeanGust: GUESSES.map((g, gi) => round(mean(both.map((x) => x.archive[gi])), 1)),
    windyAgreement: GUESSES.map((g, gi) => { const w = pairs.filter((x) => x.replayWindy); return { guess: g.name, hours: w.length, agree: w.filter((x) => x.replayWindy[gi] === x.servedWindy).length, servedWindy: w.filter((x) => x.servedWindy).length, replayWindy: w.filter((x) => x.replayWindy[gi]).length }; }) };
}

// ---------- the rung, replayed ----------
// opts: { G, K, corr: (row) → multiplier for every gust (1 = none) }
function windy(row, gi, { G = GUST_LINE_TODAY, K = 0, corr = null } = {}) {
  const P = row.pre[gi]; const f = (corr ? corr(row) : 1) * gustScale;
  const gusts = P.gusts.map((x) => (isNum(x) ? x * f : null));
  const maxG = maxOf(gusts), L = P.line;
  const fire = (isNum(L.kph) && L.kph >= L.thresholdKph) || (isNum(maxG) && maxG >= G) || (K > 0 && P.slots.filter((v) => isNum(v) && v >= 25).length >= K);
  if (!fire) return false;
  if (P.slots.filter(isNum).length >= 3) {
    let sup = 0;
    P.slots.forEach((w, i) => { const gg = i < 3 ? gusts[i] : null; if ((isNum(w) && w * L.sourceFactor >= L.thresholdKph * 0.8) || (isNum(gg) && gg >= G * 0.8)) sup++; });
    if (sup < 2) return false;
  }
  return true;
}
const score = (R, gi, opt) => {
  const P = R.filter((r) => r.pumping), C = R.filter((r) => r.calm), W = R.filter((r) => windy(r, gi, opt));
  return { pumping: P.length, caught: P.filter((r) => windy(r, gi, opt)).length, calm: C.length, falseCalls: C.filter((r) => windy(r, gi, opt)).length, windyCalls: W.length, band: W.filter((r) => !r.pumping && !r.calm).length };
};
const pct = (a, b) => (b ? (100 * a) / b : null);
const summary = (sc) => ({ ...sc, caughtPct: round(pct(sc.caught, sc.pumping), 1), falsePer100: round(pct(sc.falseCalls, sc.calm), 2), bandShare: round(pct(sc.band, sc.windyCalls), 1) });
const avgOver = (f) => mean(GUESSES.map((_, gi) => f(gi)));

// ---------- §4 first (R2 needs it): gust correction per station, by direction ----------
const corrTable = {};
out.corrections = {};
for (const s of all.filter((x) => x.gustStation)) {
  const R = rows.filter((r) => r.s === s && isNum(r.o.gust));
  const learn = R.filter((r) => r.week % 2 !== 0), prove = R.filter((r) => r.week % 2 === 0);
  const perGuess = GUESSES.map((_, gi) => {
    const app = (r) => { const v = maxOf(r.pre[gi].gusts); return isNum(v) ? v * gustScale : null; };
    const L = learn.filter((r) => isNum(app(r)) && app(r) >= 20);
    const ratioOf = (list) => { const so = list.reduce((a, r) => a + r.o.gust, 0), sa = list.reduce((a, r) => a + app(r), 0); return sa > 0 ? Math.min(1.8, Math.max(0.8, so / sa)) : 1; };
    const allDir = L.length >= 60 ? ratioOf(L) : 1;
    return SECTORS.map((_, k) => { const Ls = L.filter((r) => sectorOf(r.dirM) === k); return { n: Ls.length, ratio: Ls.length >= 30 ? ratioOf(Ls) : allDir }; });
  });
  const table = SECTORS.map((_, k) => round(mean(perGuess.map((p) => p[k].ratio)), 3));
  const corr = (r) => table[sectorOf(r.dirM)] ?? 1;
  const res = { learnHours: learn.length, proveHours: prove.length, sectors: Object.fromEntries(SECTORS.map((n, k) => [n, { learnN: perGuess[0][k].n, ratio: table[k] }])), byGuess: [] };
  const P50 = prove.filter((r) => r.o.gust >= 50);
  res.proveBig = P50.length; res.proveBigDays = new Set(P50.map((r) => r.day)).size;
  let pass = P50.length >= 15;
  GUESSES.forEach((g, gi) => {
    const app = (r) => { const v = maxOf(r.pre[gi].gusts); return isNum(v) ? v * gustScale : null; };
    const pr = prove.filter((r) => isNum(app(r)));
    const f1 = (fx) => { let tp = 0, fp = 0, fn = 0; for (const r of pr) { const a = fx(r) >= 50, o = r.o.gust >= 50; if (a && o) tp++; else if (a) fp++; else if (o) fn++; } return { f1: tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : null, catch: tp + fn ? (100 * tp) / (tp + fn) : null }; };
    const before = f1(app), after = f1((r) => app(r) * corr(r));
    const mae = bootDiff(pr.map((r) => ({ day: r.week, a: Math.abs(app(r) * corr(r) - r.o.gust), b: Math.abs(app(r) - r.o.gust) })), 1000, 7);
    const ok = mae && mae.hi < 0 && isNum(after.f1) && isNum(before.f1) && after.f1 >= before.f1 && after.catch >= before.catch - 2;
    if (!ok) pass = false;
    res.byGuess.push({ guess: g.name, maeBefore: round(mean(pr.map((r) => Math.abs(app(r) - r.o.gust))), 2), maeAfter: round(mean(pr.map((r) => Math.abs(app(r) * corr(r) - r.o.gust))), 2), maeDiff: mae && [round(mae.diff, 2), round(mae.lo, 2), round(mae.hi, 2)], f1Before: round(before.f1, 3), f1After: round(after.f1, 3), catchBefore: round(before.catch, 1), catchAfter: round(after.catch, 1), ok });
  });
  res.ships = pass;
  if (pass) corrTable[s.id] = table;
  out.corrections[s.id] = { name: s.name, region: s.region, ...res };
}
// Fable 5: Strand's south-easter evidence, said first
{
  const R = rows.filter((r) => r.s.id === '68911' && isNum(r.o.gust));
  const se = (r) => sectorOf(r.dirM) === 3;
  out.strandSE = { learnHours: R.filter((r) => r.week % 2 !== 0 && se(r)).length, proveHours: R.filter((r) => r.week % 2 === 0 && se(r)).length,
    proveBig: R.filter((r) => r.week % 2 === 0 && se(r) && r.o.gust >= 50).length };
}

// ---------- §3 headline rules per region ----------
const regions = [...new Set(all.map((s) => s.region).filter(Boolean))].sort();
const cells = [...regions.map((rg) => ({ name: rg, test: (s) => s.region === rg })), { name: 'Strand zone', test: (s) => s.strandZone }];
out.regions = {};
for (const cell of cells) {
  const R = rows.filter((r) => cell.test(r.s));
  const T = R.filter((r) => r.day <= TUNE_TO), Pf = R.filter((r) => r.day >= PROOF_FROM);
  const res = { stations: [...new Set(R.map((r) => r.s.id))], tune: {}, proof: {} };
  const t0 = avgOver((gi) => summary(score(T, gi, {})).falsePer100), c0 = avgOver((gi) => summary(score(T, gi, {})).caughtPct);
  res.tune.R0 = { caught: round(c0, 1), false: round(t0, 2) };
  const pick = (opts) => { let best = null; for (const o of opts) { const c = avgOver((gi) => summary(score(T, gi, o)).caughtPct), f = avgOver((gi) => summary(score(T, gi, o)).falsePer100); o.tune = { caught: round(c, 1), false: round(f, 2) }; if (isNum(f) && isNum(t0) && f <= t0 + TUNE_BUDGET && isNum(c) && (!best || c > best.tune.caught || (c === best.tune.caught && (o.G ?? 99) > (best.G ?? 99)) || (c === best.tune.caught && (o.K ?? 0) > (best.K ?? 0)))) best = o; } return best; };
  const r1Opts = G_OPTIONS.filter((g) => g !== GUST_LINE_TODAY).map((G) => ({ rule: 'R1', G }));
  const r3Opts = K_OPTIONS.map((K) => ({ rule: 'R3', K }));
  const b1 = pick(r1Opts), b3 = pick(r3Opts);
  res.tune.options = [...r1Opts, ...r3Opts].map((o) => ({ rule: o.rule, G: o.G ?? null, K: o.K ?? null, ...o.tune }));
  let cand = [b1, b3].filter((b) => b && isNum(c0) && b.tune.caught > c0).sort((a, b) => b.tune.caught - a.tune.caught || a.tune.false - b.tune.false)[0] ?? null;
  res.r1G = b1?.G ?? GUST_LINE_TODAY;
  res.candidate = cand ? { rule: cand.rule, G: cand.G ?? GUST_LINE_TODAY, K: cand.K ?? 0 } : null;
  const proofOf = (list, opt) => {
    const P = list.filter((r) => r.pumping), C = list.filter((r) => r.calm);
    const perG = GUESSES.map((g, gi) => {
      const b = summary(score(list, gi, {})), a = summary(score(list, gi, opt));
      const dc = bootDiff(P.map((r) => ({ day: r.week, a: windy(r, gi, opt) ? 100 : 0, b: windy(r, gi, {}) ? 100 : 0 })), 1000, 7);
      const df = bootDiff(C.map((r) => ({ day: r.week, a: windy(r, gi, opt) ? 100 : 0, b: windy(r, gi, {}) ? 100 : 0 })), 1000, 7);
      const bar1 = dc && dc.diff >= CATCH_FLOOR && dc.lo > 0, bar2 = !df || (df.diff <= PROOF_BUDGET && df.hi <= PROOF_BUDGET_HI);
      return { guess: g.name, before: b, after: a, caughtDiff: dc && [round(dc.diff, 1), round(dc.lo, 1), round(dc.hi, 1)], falseDiff: df && [round(df.diff, 2), round(df.lo, 2), round(df.hi, 2)], bar1, bar2,
        extraCaughtPerExtraFalse: a.falseCalls - b.falseCalls > 0 ? round((a.caught - b.caught) / (a.falseCalls - b.falseCalls), 2) : null };
    });
    const bar3 = P.length >= 30 && new Set(P.map((r) => r.day)).size >= 6;
    return { pumpingHours: P.length, pumpingDays: new Set(P.map((r) => r.day)).size, calmHours: C.length, perGuess: perG, bar1: perG.every((x) => x.bar1), bar2: perG.every((x) => x.bar2), bar3 };
  };
  if (cand) {
    const opt = { G: res.candidate.G, K: res.candidate.K };
    const pr = proofOf(Pf, opt);
    res.proof = pr;
    // Fable 2: leave-one-station-out (the station with the most pumping proof hours)
    const byStation = {}; for (const r of Pf.filter((x) => x.pumping)) byStation[r.s.id] = (byStation[r.s.id] || 0) + 1;
    const top = Object.entries(byStation).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top && res.stations.length > 1) { const lo = proofOf(Pf.filter((r) => r.s.id !== top), opt); res.loso = { dropped: top, bar1: lo.bar1, bar2: lo.bar2, bar3: lo.bar3, perGuess: lo.perGuess.map((x) => ({ guess: x.guess, caughtDiff: x.caughtDiff, falseDiff: x.falseDiff })) }; }
    // Fable 9: the sign in July–August and in September (report only)
    res.split = Object.fromEntries([['Jul–Aug', (r) => r.day < '2026-09-01'], ['Sep', (r) => r.day >= '2026-09-01']].map(([n, f]) => { const x = proofOf(Pf.filter(f), opt); return [n, x.perGuess.map((y) => ({ guess: y.guess, caughtDiff: y.caughtDiff?.[0] ?? null, falseDiff: y.falseDiff?.[0] ?? null }))]; }));
    res.verdict = !pr.bar3 ? 'not enough evidence' : !pr.bar2 ? 'blocked (cries wolf)' : !pr.bar1 ? 'not clearly better' : res.loso && !(res.loso.bar1 && res.loso.bar2) ? 'fails without its top station' : 'ships';
  } else {
    res.verdict = 'no candidate beat today on the tuning months';
    res.proof = { R0: GUESSES.map((g, gi) => ({ guess: g.name, ...summary(score(Pf, gi, {})) })) };
  }
  // R2 at the corrected stations in this cell: proof months, even weeks only (out of sample for the ratios)
  const corrected = res.stations.filter((id) => corrTable[id]);
  if (corrected.length) {
    const G = res.verdict === 'ships' ? res.candidate.G : GUST_LINE_TODAY, K = res.verdict === 'ships' ? res.candidate.K : 0;
    const E = Pf.filter((r) => corrected.includes(r.s.id) && r.week % 2 === 0);
    const corr = (r) => (corrTable[r.s.id] ? corrTable[r.s.id][sectorOf(r.dirM)] ?? 1 : 1);
    const perG = GUESSES.map((g, gi) => { const b = summary(score(E, gi, { G, K })), a = summary(score(E, gi, { G, K, corr }));
      const df = bootDiff(E.filter((r) => r.calm).map((r) => ({ day: r.week, a: windy(r, gi, { G, K, corr }) ? 100 : 0, b: windy(r, gi, { G, K }) ? 100 : 0 })), 1000, 7);
      return { guess: g.name, before: b, after: a, falseDiff: df && [round(df.diff, 2), round(df.lo, 2), round(df.hi, 2)], bar2: !df || (df.diff <= PROOF_BUDGET && df.hi <= PROOF_BUDGET_HI) }; });
    res.R2 = { stations: corrected, G, K, perGuess: perG, ships: perG.every((x) => x.bar2) };
  }
  // per-station rows (Fable 2), the first guess, proof months, today's rule vs the candidate
  res.perStation = res.stations.map((id) => { const L = Pf.filter((r) => r.s.id === id); const b = summary(score(L, 0, {})); const a = res.candidate ? summary(score(L, 0, { G: res.candidate.G, K: res.candidate.K })) : b; const s = all.find((x) => x.id === id); return { id, name: s.name, kind: s.kind, pumping: b.pumping, caughtBefore: b.caught, caughtAfter: a.caught, calm: b.calm, falseBefore: b.falseCalls, falseAfter: a.falseCalls }; });
  out.regions[cell.name] = res;
}

writeFileSync(path.join(here, 'results-score7.json'), JSON.stringify(out, null, 1));
// ---------- a short text print ----------
const L = [];
L.push(`v7 score — ${out.generatedAt}`, `rows ${out.rows.total} (pumping ${out.rows.pumping}, calm ${out.rows.calm}); stations ${all.length} (${gustSt.length} SYNOP with gusts, ${airports.length} airports)`);
L.push(`Strand 68911 today 12 UTC: ${JSON.stringify(out.strandToday)}`);
L.push(`fidelity: ${JSON.stringify(out.fidelity)}`);
L.push(`Strand SE sector: ${JSON.stringify(out.strandSE)}`);
L.push('', 'CORRECTIONS (ships = passes all bars):');
for (const [id, c] of Object.entries(out.corrections)) L.push(`${id} ${c.name} (${c.region}) ships=${c.ships} big=${c.proveBig}/${c.proveBigDays}d ${c.byGuess.map((g) => `[${g.guess}: mae ${g.maeBefore}→${g.maeAfter} ${JSON.stringify(g.maeDiff)} f1 ${g.f1Before}→${g.f1After} catch ${g.catchBefore}→${g.catchAfter}]`).join(' ')} sectors ${Object.entries(c.sectors).map(([n, v]) => `${n}:${v.ratio}(${v.learnN})`).join(' ')}`);
L.push('', 'REGIONS:');
for (const [n, r] of Object.entries(out.regions)) {
  L.push(`${n}: ${r.verdict} · candidate ${JSON.stringify(r.candidate)} · tune R0 ${JSON.stringify(r.tune.R0)} · stations ${r.stations.length}`);
  if (r.proof.perGuess) for (const g of r.proof.perGuess) L.push(`   ${g.guess}: caught ${g.before.caught}/${g.before.pumping} → ${g.after.caught} (${JSON.stringify(g.caughtDiff)}), false ${g.before.falseCalls}/${g.before.calm} → ${g.after.falseCalls} (${JSON.stringify(g.falseDiff)}), band ${g.before.bandShare}→${g.after.bandShare}%, per false ${g.extraCaughtPerExtraFalse}`);
  if (r.proof.R0) for (const g of r.proof.R0) L.push(`   ${g.guess}: today caught ${g.caught}/${g.pumping}, false ${g.falseCalls}/${g.calm}`);
  if (r.loso) L.push(`   LOSO drop ${r.loso.dropped}: bar1 ${r.loso.bar1} bar2 ${r.loso.bar2}`);
  if (r.R2) L.push(`   R2 at ${r.R2.stations.join(',')}: ships=${r.R2.ships} ${r.R2.perGuess.map((g) => `${g.guess} caught ${g.before.caught}/${g.before.pumping}→${g.after.caught} false ${g.before.falseCalls}/${g.before.calm}→${g.after.falseCalls}`).join(' | ')}`);
}
writeFileSync(path.join(here, 'results-score7.txt'), L.join('\n') + '\n');
console.log(L.join('\n'));
