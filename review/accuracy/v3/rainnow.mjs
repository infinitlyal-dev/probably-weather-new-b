// "RAIN'S HERE" — the now-rung replayed hour by hour at the 13 airports that report present weather, against
// what they reported. Pre-registered in PLAN.md (with Fable's changes): votes stay at ≥ 2 distinct models (not
// tuned); only the blended chance and amount are tuned; a cell qualifies when the Wilson 95 % lower bound of its
// TRAIN (2025) same-hour hit rate is ≥ 60 % under all three source assignments; the most permissive qualifying
// cell per regime; among R1–R3 the one with the most TRAIN true calls; tested once on 2026, per region.
//   node review/accuracy/v3/rainnow.mjs
// What the replay cannot see: WeatherAPI's own words (its "Patchy rain possible" habit), Tomorrow.io's radar
// (it only adds rain; counted live). Only best_match, ECMWF 0.25° and GFS carry a rain % in the archive, so the
// replayed blended chance is ECMWF-led under every assignment.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SCORED } from '../v2/stations.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, TRAIN, TEST, inRange, isNum, mean, round, RESULTS } from '../v2/lib.mjs';
import { gridElevation } from './lib3.mjs';

const NO_WX = new Set(['FALW', 'FAHS', 'FAWB']);
const MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
const FAMILY = { best_match: 'ECMWF', ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS', icon_seamless: 'ICON', ukmo_seamless: 'UKMO', meteofrance_seamless: 'MF' };
// production slots [Open-Meteo, WeatherAPI, Pirate Weather, MET Norway, Tomorrow.io]
const ASSIGN = {
  A: ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'],   // the 22 Sept harness
  B: ['best_match', 'ecmwf_ifs025', 'icon_seamless', 'best_match', 'best_match'],          // ECMWF-heavy
  C: ['best_match', 'meteofrance_seamless', 'gfs_seamless', 'best_match', 'icon_seamless'], // mixed
};
const HOURLY_W = { OM: 0.30, WA: 0.22, MET: 0.20, TI: 0.15 };  // production base weights, Pirate has no hourly
const metProxy = (mm) => (!isNum(mm) ? null : mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80);
const RAINY = (c) => isNum(c) && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95);   // a description saying rain
const SHOWERY = (c) => isNum(c) && ((c >= 80 && c <= 82) || c >= 95);
const wavg = (pairs) => { let s = 0, w = 0; for (const [v, k] of pairs) if (isNum(v)) { s += v * k; w += k; } return w ? s / w : null; };
const NEAR_WX = /\bVC(SH|TS)\b/;

const rows = [];
for (const st of SCORED.filter((s) => !NO_WX.has(s.id))) {
  const obs = loadObs(st.id);
  const R = Object.fromEntries(MODELS.map((m) => [m, loadRuns(st.id, m)]));
  const Hh = { best_match: loadHist(st.id, 'best_match'), ecmwf_ifs025: loadHist(st.id, 'ecmwf_ifs025'), gfs_seamless: loadHist(st.id, 'gfs_seamless') };
  if (MODELS.some((m) => !R[m]) || Object.values(Hh).some((x) => !x)) { console.error(`${st.id}: data missing`); continue; }
  const elev = gridElevation(st.id) ?? st.elev;
  for (const d of days('2025-01-01', '2026-09-24')) for (let h = 0; h < 24; h++) {
    const k = hourKey(d, h), o = obs.get(k);
    if (!o) continue;
    const near = [-1, 0, 1].some((dh) => { const t = new Date(Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`) + dh * 3600e3).toISOString().slice(0, 13); const x = obs.get(t); return x && (x.precip || x.precipAnyReport || (x.all || [x]).some((r) => NEAR_WX.test(r.metar || ''))); });
    const at = (m) => R[m].get(k), pp = (m) => Hh[m]?.get(k)?.pp;
    const byAssign = {};
    for (const [an, S] of Object.entries(ASSIGN)) {
      const fams = new Map();
      for (const m of S) { const c = at(m)?.code; const f = FAMILY[m]; if (!fams.has(f) || m === 'best_match') fams.set(f, c); }
      const votes = [...fams.values()].filter(RAINY).length;
      const chance = wavg([[pp(S[0]), HOURLY_W.OM], [pp(S[1]), HOURLY_W.WA], [metProxy(at(S[3])?.p0), HOURLY_W.MET], [pp(S[4]), HOURLY_W.TI]]);
      const amount = wavg([[at(S[0])?.p0, HOURLY_W.OM], [at(S[1])?.p0, HOURLY_W.WA], [at(S[3])?.p0, HOURLY_W.MET], [at(S[4])?.p0, HOURLY_W.TI]]);
      const wind = mean(S.map((m) => at(m)?.w0));
      const gust = Math.max(...[S[0], S[1], S[2]].map((m) => Hh[m]?.get(k)?.gust).filter(isNum), -1);
      byAssign[an] = { votes, chance, amount, windy: (isNum(wind) && wind >= 25) || gust >= 55 };
    }
    rows.push({ id: st.id, region: st.region, day: d, h, elev, wet: Boolean(o.precip || o.precipAnyReport), near,
      showery: SHOWERY(at('best_match')?.code), inlandPm: elev >= 500 && h >= 12 && h <= 20, a: byAssign });
  }
}

const P_GRID = [60, 70, 80, 90], M_GRID = [0.3, 0.5, 1, 2];
const call = (cell) => (r, an) => { const x = r.a[an]; return x.votes >= 2 && isNum(x.chance) && x.chance >= cell.p && isNum(x.amount) && x.amount >= cell.m; };
const R0 = { p: 60, m: 0.3 };
const wilsonLo = (k, n) => { if (!n) return 0; const z = 1.96, p = k / n; return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n); };
const tally = (list, fn, an) => { let calls = 0, hits = 0; for (const r of list) if (fn(r, an)) { calls++; if (r.wet) hits++; } return { calls, hits, rate: calls ? hits / calls : null, lo: wilsonLo(hits, calls) }; };

const train = rows.filter((r) => inRange(r.day, TRAIN)), test = rows.filter((r) => inRange(r.day, TEST));
const REGIMES = {
  R1: { national: () => true },
  R2: { showery: (r) => r.showery, steady: (r) => !r.showery },
  R3: { 'inland afternoon': (r) => r.inlandPm, rest: (r) => !r.inlandPm },
};
const choose = (inRegime) => {
  const cells = [];
  for (const p of P_GRID) for (const m of M_GRID) {
    const c = { p, m }, per = Object.keys(ASSIGN).map((an) => tally(train.filter(inRegime), call(c), an));
    cells.push({ ...c, lo: Math.min(...per.map((t) => t.lo)), calls: mean(per.map((t) => t.calls)), hits: mean(per.map((t) => t.hits)) });
  }
  const ok = cells.filter((c) => c.lo >= 0.6).sort((a, b) => b.calls - a.calls);
  return ok.length ? { ...ok[0], qualified: true } : { ...cells.find((c) => c.p === 90 && c.m === 2), qualified: false };   // strictest; "never" is Al's call
};
const candidates = {};
for (const [name, regimes] of Object.entries(REGIMES)) {
  const cells = Object.fromEntries(Object.entries(regimes).map(([g, f]) => [g, choose(f)]));
  const fn = (r, an) => { const g = Object.entries(regimes).find(([, f]) => f(r))[0]; return call(cells[g])(r, an); };
  candidates[name] = { cells, fn, trainHits: mean(Object.keys(ASSIGN).map((an) => tally(train, fn, an).hits)) };
}
const pickName = Object.entries(candidates).sort((a, b) => b[1].trainHits - a[1].trainHits)[0][0];
const pick = candidates[pickName];

// ---- test ----
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
const falseShareDiff = (list, fa, fb, an) => {
  const byWeek = new Map(); for (const r of list) (byWeek.get(week(r.day)) || byWeek.set(week(r.day), []).get(week(r.day))).push(r);
  const weeks = [...byWeek.values()];
  const stat = (ws) => { const all = ws.flat(); const a = tally(all, fa, an), b = tally(all, fb, an); return isNum(a.rate) && isNum(b.rate) ? (1 - a.rate) - (1 - b.rate) : null; };
  const point = stat(weeks);
  let s = 7 >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const reps = []; for (let k = 0; k < 1000; k++) { const pk = []; for (let i = 0; i < weeks.length; i++) pk.push(weeks[Math.floor(rnd() * weeks.length)]); const v = stat(pk); if (isNum(v)) reps.push(v); }
  reps.sort((a, b) => a - b);
  return reps.length >= 900 && isNum(point) ? { diff: point, lo: reps[Math.floor(0.025 * reps.length)], hi: reps[Math.ceil(0.975 * reps.length) - 1] } : { diff: point, lo: null, hi: null };
};
const r0 = call(R0);
const describe = (list, fn) => Object.fromEntries(Object.keys(ASSIGN).map((an) => {
  const t = tally(list, fn, an), near = list.filter((r) => fn(r, an)).filter((r) => r.near).length;
  const demotedWet = list.filter((r) => r0(r, an) && !fn(r, an) && r.wet);
  return [an, { ...t, hiWilson: null, nearRate: t.calls ? near / t.calls : null, rainHoursCalled: list.filter((r) => r.wet && fn(r, an)).length, rainHours: list.filter((r) => r.wet).length,
    demotedWetToWind: demotedWet.filter((r) => r.a[an].windy).length }];
}));
const out = { train: TRAIN, test: TEST, assignments: ASSIGN, pick: pickName,
  candidates: Object.fromEntries(Object.entries(candidates).map(([n, c]) => [n, { cells: c.cells, trainHits: c.trainHits }])),
  testPooled: {}, testByRegion: {}, all3OnTest: {}, descriptive: {} };
out.testPooled = { r0: describe(test, r0), pick: describe(test, pick.fn), diff: Object.fromEntries(Object.keys(ASSIGN).map((an) => [an, falseShareDiff(test, pick.fn, r0, an)])) };
for (const [n, c] of Object.entries(candidates)) out.all3OnTest[n] = describe(test, c.fn);
const regions = [...new Set(test.map((r) => r.region))];
for (const g of regions) {
  const l = test.filter((r) => r.region === g);
  const diffs = Object.fromEntries(Object.keys(ASSIGN).map((an) => [an, falseShareDiff(l, pick.fn, r0, an)]));
  const r0calls = Math.min(...Object.keys(ASSIGN).map((an) => tally(l, r0, an).calls));
  out.testByRegion[g] = { r0: describe(l, r0), pick: describe(l, pick.fn), diff: diffs, r0calls,
    ships: r0calls >= 30 && Object.values(diffs).every((b) => isNum(b.hi) && b.hi < 0) };
}
// what separates real from false calls under today's rule (assignment A, 2025 + 2026): descriptive only
const byKey = (keyFn) => { const m = {}; for (const r of rows) if (r0(r, 'A')) { const k = keyFn(r); (m[k] ||= { calls: 0, wet: 0 }); m[k].calls++; if (r.wet) m[k].wet++; } return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { calls: v.calls, falseShare: 1 - v.wet / v.calls }])); };
const part = (h) => (h < 6 ? 'night 00–05' : h < 12 ? 'morning 06–11' : h < 18 ? 'afternoon 12–17' : 'evening 18–23');
out.descriptive = {
  byRegionAndTime: byKey((r) => `${r.region} · ${part(r.h)}`),
  byVotes: byKey((r) => `${r.a.A.votes} models`),
  byChance: byKey((r) => (r.a.A.chance >= 90 ? '90+' : r.a.A.chance >= 80 ? '80–89' : r.a.A.chance >= 70 ? '70–79' : '60–69')),
  byAmount: byKey((r) => (r.a.A.amount >= 2 ? '2+ mm' : r.a.A.amount >= 1 ? '1–2 mm' : r.a.A.amount >= 0.5 ? '0.5–1 mm' : '0.3–0.5 mm')),
  byType: byKey((r) => (r.showery ? 'showers / thunder' : 'steady rain / drizzle')),
};

mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v3-rainnow.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));

const pc = (x) => (isNum(x) ? `${Math.round(x * 100)}%` : '—');
const ci = (b) => (b && isNum(b.lo) ? `${(b.diff * 100).toFixed(1)} [${(b.lo * 100).toFixed(1)}, ${(b.hi * 100).toFixed(1)}]` : '—');
console.log(`RAIN'S HERE — ${rows.length} airport-hours (${train.length} train 2025, ${test.length} test 2026)`);
for (const [n, c] of Object.entries(candidates)) console.log(`${n}: ${Object.entries(c.cells).map(([g, x]) => `${g} ≥${x.p}% & ≥${x.m} mm (TRAIN lo ${pc(x.lo)}, calls ${Math.round(x.calls)}${x.qualified ? '' : ', NOT QUALIFIED'})`).join(' | ')} → TRAIN true calls ${Math.round(c.trainHits)}`);
console.log(`PICK: ${pickName}`);
const show = (lab, d) => console.log(`  ${lab.padEnd(8)} ${Object.entries(d).map(([an, t]) => `${an}: calls ${t.calls}, right ${pc(t.rate)} [lo ${pc(t.lo)}], ±1h ${pc(t.nearRate)}, rain hours called ${t.rainHoursCalled}/${t.rainHours}`).join(' · ')}`);
console.log('TEST pooled:'); show('today', out.testPooled.r0); show('pick', out.testPooled.pick);
console.log('  false-share change (pick − today, points):', Object.entries(out.testPooled.diff).map(([an, b]) => `${an} ${ci(b)}`).join(' · '));
console.log('  demoted rain hours shown as wind instead of might-rain:', Object.entries(out.testPooled.pick).map(([an, t]) => `${an} ${t.demotedWetToWind}`).join(' · '));
console.log('All three candidates on TEST (assignment A: calls, right):', Object.entries(out.all3OnTest).map(([n, d]) => `${n} ${d.A.calls} ${pc(d.A.rate)}`).join(' · '));
console.log('By region (TEST): today → pick false share [change CI per assignment] · ships?');
for (const [g, r] of Object.entries(out.testByRegion)) console.log(`  ${g.padEnd(14)} A ${pc(1 - r.r0.A.rate)} → ${pc(1 - r.pick.A.rate)} (calls ${r.r0.A.calls} → ${r.pick.A.calls}) · ${Object.entries(r.diff).map(([an, b]) => `${an} ${ci(b)}`).join(' ')} · ${r.ships ? 'SHIPS' : 'stays today'}`);
console.log('Descriptive (today\'s rule, A, both years): false share by region × time of day');
for (const [k, v] of Object.entries(out.descriptive.byRegionAndTime).sort()) if (v.calls >= 20) console.log(`  ${k.padEnd(34)} ${pc(v.falseShare)} of ${v.calls}`);
for (const key of ['byVotes', 'byChance', 'byAmount', 'byType']) console.log(`  ${key}: ${Object.entries(out.descriptive[key]).map(([k, v]) => `${k} ${pc(v.falseShare)} (${v.calls})`).join(' · ')}`);
