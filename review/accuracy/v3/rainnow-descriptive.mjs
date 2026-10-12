// "rain-now-descriptive" (Strand, 12 Oct 2026) — a CANDIDATE third route to "Rain's here", replayed before anyone
// rules. Not tuned: the candidate and its two neighbours are fixed in the brief.
//   candidate  ≥ 3 sources describing rain now, from ≥ 2 model families (Open-Meteo + WeatherAPI = one ECMWF family),
//              ≥ 0.5 mm blended for the hour; probability not read
//   (a)        the same with ≥ 0.3 mm
//   (b)        ≥ 2 families but only ≥ 2 votes, ≥ 0.5 mm
// each added to today's strict cell (≥ 2 votes, ≥ 90 %, ≥ 2 mm), never instead of it.
//
//   node review/accuracy/v3/rainnow-descriptive.mjs
//
// The row loop is rainnow.mjs's (lines 33–56), copied so the 25 Sept numbers are reproduced first (the script stops
// if today's cell does not give rainnow.mjs's TEST counts). Added per row: each production slot's own rain word
// (the stand-in model's weather code), the count of slots describing rain (a model copied into two slots counts
// once), and the families those slots span by production slot (api/weather.js RAIN_FAMILY). The archive has no
// WeatherAPI / MET Norway / Tomorrow.io words — every "description" is a stand-in model's code, as on 25 Sept.
// Today's cell keeps rainnow.mjs's vote count (distinct stand-in families), so its numbers are the 25 Sept ones.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { SCORED } from '../v2/stations.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, TEST, inRange, isNum, RESULTS } from '../v2/lib.mjs';
import { RAIN_FAMILY } from '../../../api/weather.js';

const NO_WX = new Set(['FALW', 'FAHS', 'FAWB']);
const MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
const FAMILY = { best_match: 'ECMWF', ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS', icon_seamless: 'ICON', ukmo_seamless: 'UKMO', meteofrance_seamless: 'MF' };
const SLOTS = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];
const ASSIGN = {
  A: ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'],
  B: ['best_match', 'ecmwf_ifs025', 'icon_seamless', 'best_match', 'best_match'],
  C: ['best_match', 'meteofrance_seamless', 'gfs_seamless', 'best_match', 'icon_seamless'],
};
const HOURLY_W = { OM: 0.30, WA: 0.22, MET: 0.20, TI: 0.15 };
const metProxy = (mm) => (!isNum(mm) ? null : mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80);
const RAINY = (c) => isNum(c) && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95);
const wavg = (pairs) => { let s = 0, w = 0; for (const [v, k] of pairs) if (isNum(v)) { s += v * k; w += k; } return w ? s / w : null; };
const NEAR_WX = /\bVC(SH|TS)\b/;
const shift = (d, h, dh) => new Date(Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`) + dh * 3600e3).toISOString().slice(0, 13);

const rows = [];
for (const st of SCORED.filter((s) => !NO_WX.has(s.id))) {
  const obs = loadObs(st.id);
  const R = Object.fromEntries(MODELS.map((m) => [m, loadRuns(st.id, m)]));
  const Hh = { best_match: loadHist(st.id, 'best_match'), ecmwf_ifs025: loadHist(st.id, 'ecmwf_ifs025'), gfs_seamless: loadHist(st.id, 'gfs_seamless') };
  if (MODELS.some((m) => !R[m]) || Object.values(Hh).some((x) => !x)) { console.error(`${st.id}: data missing`); continue; }
  for (const d of days('2025-01-01', '2026-09-24')) for (let h = 0; h < 24; h++) {
    const k = hourKey(d, h), o = obs.get(k);
    if (!o) continue;
    const near = [-1, 0, 1].some((dh) => { const x = obs.get(shift(d, h, dh)); return x && (x.precip || x.precipAnyReport || (x.all || [x]).some((r) => NEAR_WX.test(r.metar || ''))); });
    const at = (m) => R[m].get(k), pp = (m) => Hh[m]?.get(k)?.pp;
    const byAssign = {};
    for (const [an, S] of Object.entries(ASSIGN)) {
      // rainnow.mjs: votes = distinct stand-in model families describing rain (today's cell, as replayed 25 Sept)
      const fams = new Map();
      for (const m of S) { const c = at(m)?.code; const f = FAMILY[m]; if (!fams.has(f) || m === 'best_match') fams.set(f, c); }
      const votes = [...fams.values()].filter(RAINY).length;
      const chance = wavg([[pp(S[0]), HOURLY_W.OM], [pp(S[1]), HOURLY_W.WA], [metProxy(at(S[3])?.p0), HOURLY_W.MET], [pp(S[4]), HOURLY_W.TI]]);
      const amount = wavg([[at(S[0])?.p0, HOURLY_W.OM], [at(S[1])?.p0, HOURLY_W.WA], [at(S[3])?.p0, HOURLY_W.MET], [at(S[4])?.p0, HOURLY_W.TI]]);
      // added: production's count — each slot's own word, families by production slot. A stand-in model copied into
      // two slots (B, C) is one forecast: it counts once, under the first slot it fills.
      const codes = S.map((m) => at(m)?.code);
      const firstSlot = new Map(); S.forEach((m, i) => { if (!firstSlot.has(m)) firstSlot.set(m, SLOTS[i]); });
      const rainSlots = [...firstSlot].filter(([m]) => RAINY(at(m)?.code)).map(([, s]) => s);
      byAssign[an] = { votes, chance, amount, complete: codes.every(isNum), slotVotes: rainSlots.length, families: new Set(rainSlots.map((s) => RAIN_FAMILY[s])).size };
    }
    rows.push({ id: st.id, region: st.region, day: d, h, key: `${st.id}|${k}`, wet: Boolean(o.precip || o.precipAnyReport), near, a: byAssign });
  }
}
const byKey = new Map(rows.map((r) => [r.key, r]));

const today = (r, an) => { const x = r.a[an]; return x.votes >= 2 && isNum(x.chance) && x.chance >= 90 && isNum(x.amount) && x.amount >= 2; };
const desc = (minVotes, minMm) => (r, an) => { const x = r.a[an]; return x.slotVotes >= minVotes && x.families >= 2 && isNum(x.amount) && x.amount >= minMm; };
const RULES = {
  today: today,
  candidate: (r, an) => today(r, an) || desc(3, 0.5)(r, an),
  'neighbour (a) 0.3 mm': (r, an) => today(r, an) || desc(3, 0.3)(r, an),
  'neighbour (b) 2 votes': (r, an) => today(r, an) || desc(2, 0.5)(r, an),
};

const test = rows.filter((r) => inRange(r.day, TEST));
// Faithfulness: today's cell on all TEST hours must give rainnow.mjs's 25 Sept counts (v2/results/v3-rainnow.txt).
const EXPECT = { A: [372, 272], B: [482, 353], C: [410, 307] };
for (const [an, [calls, hits]] of Object.entries(EXPECT)) {
  const c = test.filter((r) => today(r, an)), hc = c.filter((r) => r.wet).length;
  if (c.length !== calls || hc !== hits) { console.error(`NOT FAITHFUL: assignment ${an} today ${c.length}/${hc}, rainnow.mjs ${calls}/${hits}`); process.exit(1); }
}

const score = (list, fn, an) => {
  const calls = list.filter((r) => fn(r, an)), wet = list.filter((r) => r.wet);
  const calledNear = (r) => [-1, 0, 1].some((dh) => { const x = byKey.get(`${r.id}|${shift(r.day, r.h, dh)}`); return x && fn(x, an); });
  const right = calls.filter((r) => r.wet).length, rightNear = calls.filter((r) => r.near).length;
  return { calls: calls.length, right, rightNear, dry: calls.length - right, dryNear: calls.length - rightNear,
    wet: wet.length, caught: wet.filter((r) => fn(r, an)).length, caughtNear: wet.filter(calledNear).length };
};
const ANS = Object.keys(ASSIGN);
const out = { test: TEST, hours: test.length, missingWords: Object.fromEntries(ANS.map((an) => [an, test.filter((r) => !r.a[an].complete).length])), pooled: {}, byRegion: {}, tonight: {} };
const scored = (an) => test.filter((r) => r.a[an].complete);
for (const an of ANS) {
  const list = scored(an);
  out.pooled[an] = Object.fromEntries(Object.entries(RULES).map(([n, f]) => [n, score(list, f, an)]));
  out.byRegion[an] = {};
  for (const g of [...new Set(list.map((r) => r.region))]) out.byRegion[an][g] = Object.fromEntries(Object.entries(RULES).map(([n, f]) => [n, score(list.filter((r) => r.region === g), f, an)]));
  // tonight's kind of hour: 3+ descriptive votes, < 60 %, 0.5–2 mm
  const kind = list.filter((r) => { const x = r.a[an]; return x.slotVotes >= 3 && isNum(x.chance) && x.chance < 60 && isNum(x.amount) && x.amount >= 0.5 && x.amount < 2; });
  const kind2f = kind.filter((r) => r.a[an].families >= 2);
  out.tonight[an] = { hours: kind.length, wet: kind.filter((r) => r.wet).length, near: kind.filter((r) => r.near).length,
    twoFamilies: kind2f.length, twoFamiliesWet: kind2f.filter((r) => r.wet).length, twoFamiliesNear: kind2f.filter((r) => r.near).length,
    byRegion: Object.fromEntries([...new Set(kind2f.map((r) => r.region))].map((g) => { const l = kind2f.filter((r) => r.region === g); return [g, { hours: l.length, wet: l.filter((r) => r.wet).length }]; })) };
}
writeFileSync(path.join(RESULTS, 'rain-now-descriptive.json'), JSON.stringify(out, null, 1));

const pc = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
console.log(`TEST ${TEST.from} → ${TEST.to}: ${test.length} airport-hours; hours lacking a slot's word (excluded): ${ANS.map((an) => `${an} ${out.missingWords[an]}`).join(', ')}`);
for (const an of ANS) {
  console.log(`\nAssignment ${an} — pooled`);
  for (const [n, s] of Object.entries(out.pooled[an])) console.log(`  ${n.padEnd(22)} calls ${s.calls}  right ${pc(s.right, s.calls)} (±1h ${pc(s.rightNear, s.calls)})  dry ${s.dry} = ${pc(s.dry, s.calls)}  caught ${s.caught}/${s.wet} = ${pc(s.caught, s.wet)} (±1h ${pc(s.caughtNear, s.wet)})`);
  const t = out.tonight[an];
  console.log(`  tonight's kind: ${t.hours} hours, wet ${pc(t.wet, t.hours)} (±1h ${pc(t.near, t.hours)}); of them 2+ families ${t.twoFamilies}, wet ${pc(t.twoFamiliesWet, t.twoFamilies)} (±1h ${pc(t.twoFamiliesNear, t.twoFamilies)})`);
}
console.log('\nAssignment A by region: today → candidate (calls, right, dry, caught/wet)');
for (const [g, s] of Object.entries(out.byRegion.A)) {
  const a = s.today, b = s.candidate;
  console.log(`  ${g.padEnd(14)} ${a.calls} ${pc(a.right, a.calls)} dry ${a.dry} caught ${a.caught}/${a.wet} → ${b.calls} ${pc(b.right, b.calls)} dry ${b.dry} caught ${b.caught}/${b.wet} (±1h ${pc(b.caughtNear, b.wet)})`);
}
