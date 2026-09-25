// "SHOWERS NEARBY." — how often the new wording would show, and how often it rained at the airport in those
// hours. Al's ruling of 25 Sept 2026 (review/rain-fog-frost-ruled.json): "Rain's here" is the strict cell
// (≥ 2 models describing rain, ≥ 90 %, ≥ 2 mm) everywhere; an hour the old rule (≥ 60 %, ≥ 0.3 mm) called
// "Rain's here" and strict does not says "Showers nearby." where "Might rain." would be — so not in the hours
// wind outranks it. The same replay as rainnow.mjs (same stations, stand-ins, blend and truth), counted, not tuned.
//   node review/accuracy/v3/showers.mjs
// Truth: rain at the airport in that hour (any report); "near" = rain, or showers / thunder in the vicinity
// (VCSH / VCTS), in that hour or either neighbour. The replay cannot see Tomorrow.io's radar (it can turn a
// showers-nearby hour into "Rain's here" live) nor the UV rung (it needs UV ≥ 8 under a sky that is not
// mostly cloudy; rare in these hours).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SCORED } from '../v2/stations.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, TEST, inRange, isNum, mean, round, RESULTS } from '../v2/lib.mjs';
import { RAIN_NOW_MIN_VOTES, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM, SHOWERS_NEARBY_MIN_PROB, SHOWERS_NEARBY_MIN_MM, RAIN_POSSIBLE_NOW_MIN_PROB } from '../../../api/weather.js';

// ---- the replay, as rainnow.mjs builds it ----
const NO_WX = new Set(['FALW', 'FAHS', 'FAWB']);
const MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
const FAMILY = { best_match: 'ECMWF', ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS', icon_seamless: 'ICON', ukmo_seamless: 'UKMO', meteofrance_seamless: 'MF' };
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

const rows = [];
for (const st of SCORED.filter((s) => !NO_WX.has(s.id))) {
  const obs = loadObs(st.id);
  const R = Object.fromEntries(MODELS.map((m) => [m, loadRuns(st.id, m)]));
  const Hh = { best_match: loadHist(st.id, 'best_match'), ecmwf_ifs025: loadHist(st.id, 'ecmwf_ifs025'), gfs_seamless: loadHist(st.id, 'gfs_seamless') };
  if (MODELS.some((m) => !R[m]) || Object.values(Hh).some((x) => !x)) { console.error(`${st.id}: data missing`); continue; }
  for (const d of days('2025-01-01', '2026-09-24')) for (let h = 0; h < 24; h++) {
    const k = hourKey(d, h), o = obs.get(k);
    if (!o) continue;
    const near = [-1, 0, 1].some((dh) => { const t = new Date(Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`) + dh * 3600e3).toISOString().slice(0, 13); const x = obs.get(t); return x && (x.precip || x.precipAnyReport || (x.all || [x]).some((r) => NEAR_WX.test(r.metar || ''))); });
    const at = (m) => R[m].get(k), pp = (m) => Hh[m]?.get(k)?.pp;
    const a = {};
    for (const [an, S] of Object.entries(ASSIGN)) {
      const fams = new Map();
      for (const m of S) { const c = at(m)?.code; const f = FAMILY[m]; if (!fams.has(f) || m === 'best_match') fams.set(f, c); }
      const votes = [...fams.values()].filter(RAINY).length;
      const chance = wavg([[pp(S[0]), HOURLY_W.OM], [pp(S[1]), HOURLY_W.WA], [metProxy(at(S[3])?.p0), HOURLY_W.MET], [pp(S[4]), HOURLY_W.TI]]);
      const amount = wavg([[at(S[0])?.p0, HOURLY_W.OM], [at(S[1])?.p0, HOURLY_W.WA], [at(S[3])?.p0, HOURLY_W.MET], [at(S[4])?.p0, HOURLY_W.TI]]);
      const wind = mean(S.map((m) => at(m)?.w0));
      const gust = Math.max(...[S[0], S[1], S[2]].map((m) => Hh[m]?.get(k)?.gust).filter(isNum), -1);
      a[an] = { votes, chance, amount, windy: (isNum(wind) && wind >= 25) || gust >= 55 };
    }
    rows.push({ region: st.region, day: d, wet: Boolean(o.precip || o.precipAnyReport), near, a });
  }
}

// ---- the three hero states the ruling produces (the replay's view of the now-ladder) ----
const ev = (x, p, m) => x.votes >= RAIN_NOW_MIN_VOTES && isNum(x.chance) && x.chance >= p && isNum(x.amount) && x.amount >= m;
const state = (r, an) => {
  const x = r.a[an];
  if (ev(x, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM)) return 'rain';
  if (x.windy) return 'wind';
  if (ev(x, SHOWERS_NEARBY_MIN_PROB, SHOWERS_NEARBY_MIN_MM)) return 'nearby';
  if (isNum(x.chance) && x.chance >= RAIN_POSSIBLE_NOW_MIN_PROB) return 'maybe';
  return 'other';
};
const count = (list, an, s) => { const hs = list.filter((r) => state(r, an) === s); return { hours: hs.length, rained: hs.filter((r) => r.wet).length, rainedOrNear: hs.filter((r) => r.wet || r.near).length }; };
const summary = (list) => Object.fromEntries(Object.keys(ASSIGN).map((an) => [an, { airportHours: list.length, rainHours: list.filter((r) => r.wet).length,
  nearby: count(list, an, 'nearby'), rain: count(list, an, 'rain'), maybe: count(list, an, 'maybe') }]));

const test = rows.filter((r) => inRange(r.day, TEST));
const out = { rule: { rainHere: { votes: RAIN_NOW_MIN_VOTES, prob: RAIN_NOW_MIN_PROB, mm: RAIN_NOW_MIN_MM }, showersNearby: { prob: SHOWERS_NEARBY_MIN_PROB, mm: SHOWERS_NEARBY_MIN_MM } },
  test: TEST, pooled: { test: summary(test), both: summary(rows) }, byRegion: {} };
for (const g of [...new Set(test.map((r) => r.region))].sort()) out.byRegion[g] = summary(test.filter((r) => r.region === g));
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v3-showers.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));

const pc = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const rng = (vals) => { const lo = Math.min(...vals), hi = Math.max(...vals); return lo === hi ? `${lo}` : `${lo}–${hi}`; };
const line = (lab, s) => {
  const v = Object.values(s);
  const per1000 = v.map((x) => Math.round((x.nearby.hours / x.airportHours) * 1000));
  return `${lab}: ${v[0].airportHours} airport-hours, ${v[0].rainHours} with rain · "Showers nearby." ${rng(v.map((x) => x.nearby.hours))} hours (${rng(per1000)} per 1,000), rained that hour ${rng(v.map((x) => x.nearby.rained))} (${v.map((x) => pc(x.nearby.rained, x.nearby.hours)).join(' / ')}), rain or showers in sight within the hour either side ${v.map((x) => pc(x.nearby.rainedOrNear, x.nearby.hours)).join(' / ')}`
    + ` · "Rain's here" ${rng(v.map((x) => x.rain.hours))} hours, right ${v.map((x) => pc(x.rain.rained, x.rain.hours)).join(' / ')} · plain "Might rain." ${rng(v.map((x) => x.maybe.hours))} hours, rained ${v.map((x) => pc(x.maybe.rained, x.maybe.hours)).join(' / ')}`;
};
console.log(`SHOWERS NEARBY — replay, 13 airports, three source assignments (A / B / C)`);
console.log(line('TEST 2026', out.pooled.test));
console.log(line('2025 + 2026', out.pooled.both));
for (const [g, s] of Object.entries(out.byRegion)) console.log(line(`  ${g}`, s));
