// BLEND VS SOURCES — does the blend beat every single source it blends?
//
//   node review/accuracy/blend-vs-sources.mjs                   # morning read 06:00, evening 18:00, 1000 draws
//   node review/accuracy/blend-vs-sources.mjs --hour 6 --late 18 --boot 1000
//
// First measured 23 September 2026. Per airport and all six together, 24 Jun → 22 Sep 2026:
//   (a) daily high, (b) daily low — each source: the max / min of its archived hourly
//       temperatures on the local (SAST) calendar day. The blend: production's day-0
//       highC / lowC (api/weather.js:2068–2069), built from what each slot feeds it when the
//       app is opened at --hour, with the dynamic weights decided for that day and hour.
//   (c) rain — hourly probability (Brier, reliability, yes/no at the now-ladder's lines)
//       and the daily chance (Brier, reliability, yes/no at the daily ladder's lines).
//   (d) wind — hourly mean speed against the METAR 10-minute mean; gusts against the
//       METAR gust group, in the hours that carry one.
// Ground truth: lib/obs.mjs. Sources: the five archived stand-ins of lib/sources.mjs in
// production's slot order. The weighting is copied from the handler below with line
// numbers (it lives inside the one handler function and cannot be imported); the rain
// thresholds and the MET mm→% proxies are imported, not copied.
//
// Output: results/blend-vs-sources.md (report), .json (numbers + every scored day),
// results/blend-vs-sources-hours.csv (every scored hour; git-ignored).

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadStationHourly } from './lib/obs.mjs';
import { CITIES, RANGE, ACCURACY_ROOT, loadCity, metHourlyRainProxy, metDailyRainProxy } from './lib/sources.mjs';
import { RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM, RAIN_POSSIBLE_NOW_MIN_PROB } from '../../api/weather.js';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const REQ_HOUR = Number(argOf('--hour', 6));     // the morning read: the day's high / low / rain % as the app serves them then
const LATE_HOUR = Number(argOf('--late', 18));   // the same day-0 blend read in the evening (sensitivity rows only)
const BOOT = Number(argOf('--boot', 1000));      // day-block bootstrap draws for the 95% intervals

// Coverage rules (stated in the report).
const TEMP_RULE = { minHours: 18, minWindow: [4, 8], maxWindow: [12, 16] }; // hours with a temperature; ≥ 1 report in each window
const RAIN_DAY_RULE = { minHours: 18 };                                        // hours with a report, and none with present weather unobserved
const DAILY_RAIN_LINES = [30, 60];  // daily ladder: ≥ 30 → rain (moderate-rain-prob, api/weather.js:3407), ≥ 60 → rain (heavy-rain-prob, :3398)
const OBS_WINDY = { sustainedKph: 30, gustKph: 45 };  // run-eval.mjs, for the hours CSV only

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const rnd = (v, d) => (isNum(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const maxOf = (a) => { const v = a.filter(isNum); return v.length ? Math.max(...v) : null; };
const minOf = (a) => { const v = a.filter(isNum); return v.length ? Math.min(...v) : null; };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

// ---------------------------------------------------------------------------
// Slots. lib/sources.mjs:68–70 — production slot → archived stand-in.
// ---------------------------------------------------------------------------
const SLOT_KEYS = ['bm', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'];
const SRC = ['OM', 'WA', 'PW', 'MET', 'TI'];
const LABEL = {
  OM: 'OM — Open-Meteo (best_match)', WA: 'WA — WeatherAPI (stand-in: ECMWF IFS 0.25°)', PW: 'PW — Pirate Weather (stand-in: GFS)',
  MET: 'MET — MET Norway (stand-in: UKMO)', TI: 'TI — Tomorrow.io (stand-in: ICON)',
  blend: `**blend, as served at ${String(REQ_HOUR).padStart(2, '0')}:00**`, blendFull: 'blend, full-day inputs (sensitivity)',
  blendLate: `blend, as served at ${String(LATE_HOUR).padStart(2, '0')}:00 (sensitivity)`,
  blendHourly: 'blend, hourly strip (4 hourly sources)', prod: '**production gust (largest of OM, WA, PW)**',
};
LABEL.blendNow = '**blend, `now.windKph` (the hero)**';

// ---------------------------------------------------------------------------
// Production's weighting, copied from the handler (api/weather.js) with citations.
// ---------------------------------------------------------------------------
// :876 base weights [OM, WA, PW, MET, TI].
const BASE_WEIGHTS = [0.30, 0.22, 0.13, 0.20, 0.15];
// :1884–1926 ECMWF dedup, MET boost (not on the Highveld), hourly re-normalisation; :1974 LOW_WEIGHTS.
function productionWeights(highs, lat, lon) {
  const W = [...BASE_WEIGHTS];
  let waDedupFactor = 1, dedup = false, metBoost = false;
  if (isNum(highs[0]) && isNum(highs[1])) {
    const ecmwfSpread = Math.abs(highs[0] - highs[1]);
    if (ecmwfSpread <= 0.5) { W[1] = W[1] / 2; waDedupFactor = 0.5; dedup = true; }
  }
  const isHighveld = lat > -28 && lon > 25;
  if (isNum(highs[3]) && !isHighveld) {
    const ecmwfFamily = [highs[0], highs[1]].filter(isNum);
    if (ecmwfFamily.length > 0) {
      const ecmwfAvg = ecmwfFamily.reduce((a, b) => a + b, 0) / ecmwfFamily.length;
      if (highs[3] - ecmwfAvg > 5) { W[0] = 0.25; W[3] = 0.40; metBoost = true; }
    }
  }
  const hBase = [W[0], W[1], W[3], W[4]];
  const hTotal = hBase.reduce((a, b) => a + b, 0);
  const HW = hBase.map((w) => w / hTotal);
  const LOW = [BASE_WEIGHTS[0], BASE_WEIGHTS[1] * waDedupFactor, BASE_WEIGHTS[2], 0, 0];
  return { W, HW, LOW, dedup, metBoost };
}
// :1935–1947
function resolveWeights(arr, baseWeights) {
  const active = arr.map((item, i) => (item !== null ? (baseWeights[i] ?? 0) : 0));
  const total = active.reduce((s, v) => s + v, 0);
  if (total === 0) {
    const count = arr.filter(Boolean).length;
    const equalWeight = count > 0 ? 1 / count : 0;
    return arr.map((item) => (item !== null ? equalWeight : 0));
  }
  return active.map((v) => v / total);
}
// :1978–1986
function wAvg(arr, weights, getter) {
  let sum = 0, wSum = 0;
  arr.forEach((item, i) => {
    if (item === null) return;
    const v = getter(item);
    if (isNum(v)) { sum += v * weights[i]; wSum += weights[i]; }
  });
  return wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
}
// Every slot answered in the archive, so every slot record exists (non-null), as when all
// five providers respond; a null VALUE inside a record is skipped by wAvg, as in production.
const blend5 = (values, weights) => { const recs = values.map((v) => ({ v })); return wAvg(recs, resolveWeights(recs, weights), (r) => r.v); };
const blend4 = (values, weights) => blend5(values, weights); // same mechanics over the four hourly slots

// What each slot feeds day 0 when the app is opened at local hour H (d = day index).
function fedDay0(S, city, d, H) {
  const base = d * 24;
  const seg = (arr, from, to) => (arr || []).slice(base + from, base + to);
  const metStrict = 24 - H >= 12;  // :1614–1620, :1646–1647 — MET's today high/low need ≥ 12 of today's hours, which start at now
  return {
    highs: [
      city.D.bm.tmax[d],                          // :1183 daily.temperature_2m_max[0], the calendar day
      maxOf(seg(S[1].temp, 0, 24)),               // :1316 WeatherAPI day.maxtemp_c, the calendar day
      maxOf(seg(S[2].temp, 7, 19)),               // :1456 Pirate temperatureHigh — its daytime high, 06:01–18:00
      metStrict ? maxOf(seg(S[3].temp, H, 24)) : null, // :1646 MET: now → midnight, null with < 12 h left
      maxOf(seg(S[4].temp, H, 24)),               // :1774–1777 Tomorrow.io: now → midnight, no minimum
    ],
    lows: [
      city.D.bm.tmin[d],                          // :1184
      minOf(seg(S[1].temp, 0, 24)),               // :1317
      minOf(seg(S[2].temp, 0, 24)),               // :1445 Pirate temperatureMin, the calendar day
      metStrict ? minOf(seg(S[3].temp, H, 24)) : null, // :1647
      minOf(seg(S[4].temp, H, 24)),               // :1778
    ],
    rains: [
      city.D.bm.ppmax[d],                         // :1185 precipitation_probability_max
      maxOf(seg(S[1].pp, 0, 24)),                 // :1321 WeatherAPI daily_chance_of_rain (stand-in: day max of hourly %)
      maxOf(seg(S[2].pp, 0, 24)),                 // :1458 Pirate precipProbability (stand-in: day max of hourly %)
      metDailyRainProxy(maxOf(seg(S[3].mm, H, 24))), // :1593–1602 MET: max mm over today's remaining hours → ladder
      maxOf(seg(S[4].pp, H, 24)),                 // :1779–1780 Tomorrow.io: max % over today's remaining hours
    ],
  };
}

// ---------------------------------------------------------------------------
// Observations helpers (lib/obs.mjs records).
// ---------------------------------------------------------------------------
// "//" in the present-weather slot = present weather NOT observed (Bloemfontein's overnight
// AUTO reports, some of George's). Such a report says nothing about rain either way.
const wxUnobservedText = (metar) => /(^|\s)\/\/(\s|$)/.test(String(metar || '').split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0]);
const precipOf = (o) => !!(o.precip || o.precipAnyReport);
const wxObserved = (o) => precipOf(o) || !o.all.every((r) => wxUnobservedText(r.metar));

// ---------------------------------------------------------------------------
// Build every scored day and hour.
// ---------------------------------------------------------------------------
const tag = `${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}`;
const dayRows = [];
const hourRows = [];
const coverage = {};
const identity = {};
for (const icao of Object.keys(CITIES)) {
  const city = loadCity(icao);
  const obs = loadStationHourly(path.join(ACCURACY_ROOT, 'obs', `metar-${icao}-${tag}.csv`));
  const S = SLOT_KEYS.map((k) => city.H[k]);
  const cov = { days: city.nDays, tempDays: 0, rainDays: 0, rainDaysDroppedUnobserved: 0, hours: 0, rainHours: 0, rainHoursUnobserved: 0, windHours: 0, gustHours: 0, dedup06: 0, boost06: 0, boostHours: 0 };

  // Stand-in facts the report quotes: is the WA stand-in's probability Open-Meteo's own?
  let ppSame = 0, mmSame = 0, ukmoPpNonZero = 0;
  for (let i = 0; i < city.nHours; i++) {
    if (S[0].pp[i] === S[1].pp[i]) ppSame++;
    if (S[0].mm[i] === S[1].mm[i]) mmSame++;
    if (isNum(S[3].pp?.[i]) && S[3].pp[i] > 0) ukmoPpNonZero++;
  }
  identity[icao] = { hours: city.nHours, omWaProbIdentical: ppSame, omWaMmIdentical: mmSame, ukmoProbNonZero: ukmoPpNonZero };

  for (let d = 0; d < city.nDays; d++) {
    const date = city.D.dates[d];
    // Observed day
    const temps = [], repHours = [];
    let rained = false, unobservedHours = 0;
    for (let h = 0; h < 24; h++) {
      const o = obs.get(`${date}T${String(h).padStart(2, '0')}`);
      if (!o) continue;
      repHours.push(h);
      if (isNum(o.tempC)) temps.push({ h, t: o.tempC });
      if (precipOf(o)) rained = true;
      else if (!wxObserved(o)) unobservedHours++;
    }
    const inWin = ([a, b]) => temps.some((x) => x.h >= a && x.h <= b);
    const tempOk = temps.length >= TEMP_RULE.minHours && inWin(TEMP_RULE.minWindow) && inWin(TEMP_RULE.maxWindow);
    const rainOk = repHours.length >= RAIN_DAY_RULE.minHours && unobservedHours === 0;
    if (repHours.length >= RAIN_DAY_RULE.minHours && unobservedHours > 0) cov.rainDaysDroppedUnobserved++;
    if (!tempOk && !rainOk) continue;

    // Single sources: the full local calendar day.
    const seg = (arr, from, to) => (arr || []).slice(d * 24 + from, d * 24 + to);
    const srcMax = S.map((s) => maxOf(seg(s.temp, 0, 24)));
    const srcMin = S.map((s) => minOf(seg(s.temp, 0, 24)));
    const srcRain = [city.D.bm.ppmax[d], maxOf(seg(S[1].pp, 0, 24)), maxOf(seg(S[2].pp, 0, 24)), metDailyRainProxy(maxOf(seg(S[3].mm, 0, 24))), maxOf(seg(S[4].pp, 0, 24))];

    // The blend: production's own weighting, decided per day from that day's highs.
    const blendAt = (fed) => {
      const w = productionWeights(fed.highs, city.lat, city.lon);
      return { high: blend5(fed.highs, w.W), low: blend5(fed.lows, w.LOW), rain: blend5(fed.rains, w.W), w };
    };
    const am = blendAt(fedDay0(S, city, d, REQ_HOUR));
    const late = blendAt(fedDay0(S, city, d, LATE_HOUR));
    const full = blendAt({ highs: srcMax, lows: srcMin, rains: srcRain });

    const row = {
      icao, date,
      tempOk, obsMax: tempOk ? Math.max(...temps.map((x) => x.t)) : null, obsMin: tempOk ? Math.min(...temps.map((x) => x.t)) : null,
      rainOk, obsRain: rainOk ? rained : null,
      max: {}, min: {}, rain: {},
      dedup: am.w.dedup, metBoost: am.w.metBoost,
    };
    SRC.forEach((c, k) => { row.max[c] = srcMax[k]; row.min[c] = srcMin[k]; row.rain[c] = srcRain[k]; });
    row.max.blend = am.high; row.min.blend = am.low; row.rain.blend = am.rain;
    row.max.blendFull = full.high; row.min.blendFull = full.low; row.rain.blendFull = full.rain;
    row.max.blendLate = late.high; row.min.blendLate = late.low; row.rain.blendLate = late.rain;
    dayRows.push(row);
    if (tempOk) cov.tempDays++;
    if (rainOk) cov.rainDays++;
    if (am.w.dedup) cov.dedup06++;
    if (am.w.metBoost) cov.boost06++;
  }

  // Hours
  for (let i = 0; i < city.nHours; i++) {
    const key = city.times[i].slice(0, 13);
    const o = obs.get(key);
    if (!o) continue;
    cov.hours++;
    const d = Math.floor(i / 24), h = i % 24;
    // The weights production would use for a request at this hour (MET's strict high changes at noon).
    const w = productionWeights(fedDay0(S, city, d, h).highs, city.lat, city.lon);
    if (w.metBoost) cov.boostHours++;
    const at = (arr) => (arr && isNum(arr[i]) ? arr[i] : null);
    // Hourly probability each slot carries in production: OM / WA / TI native %, MET the mm→% proxy (:1683–1687).
    const p = { OM: at(S[0].pp), WA: at(S[1].pp), PW: at(S[2].pp), MET: metHourlyRainProxy(at(S[3].mm)), TI: at(S[4].pp) };
    const mm = { OM: at(S[0].mm), WA: at(S[1].mm), PW: at(S[2].mm), MET: at(S[3].mm), TI: at(S[4].mm) };
    const wind = { OM: at(S[0].wind), WA: at(S[1].wind), PW: at(S[2].wind), MET: at(S[3].wind), TI: at(S[4].wind) };
    const gust = { OM: at(S[0].gust), WA: at(S[1].gust), PW: at(S[2].gust), MET: at(S[3].gust), TI: at(S[4].gust) };
    // :2046 rainChance / :2038 precipMm / :1999 windKph — hourlies [OM, WA, MET, TI] (Pirate has no hourly slot, :866–867).
    p.blend = blend4([p.OM, p.WA, p.MET, p.TI], w.HW);
    mm.blend = blend4([mm.OM, mm.WA, mm.MET, mm.TI], w.HW);
    wind.blendHourly = blend4([wind.OM, wind.WA, wind.MET, wind.TI], w.HW);
    // :2251 now.windKph — the five current winds, source weights.
    wind.blendNow = blend5([wind.OM, wind.WA, wind.PW, wind.MET, wind.TI], w.W);
    // :2264–2265 maxGust — production reads gusts from OM, WA (current.gust_kph) and Pirate only (:1192, :1327, :1462).
    gust.prod = maxOf([gust.OM, gust.WA, gust.PW]);
    const observed = wxObserved(o);
    if (observed) cov.rainHours++; else cov.rainHoursUnobserved++;
    if (isNum(o.windKph)) cov.windHours++;
    if (isNum(o.gustKph)) cov.gustHours++;
    hourRows.push({
      icao, date: city.D.dates[d], time: city.times[i], h, wxObserved: observed, obsPrecip: observed ? precipOf(o) : null,
      obsWind: o.windKph, obsGust: o.gustKph, obsWindy: (isNum(o.windKph) && o.windKph >= OBS_WINDY.sustainedKph) || (isNum(o.gustKph) && o.gustKph >= OBS_WINDY.gustKph),
      p, mm, wind, gust, dedup: w.dedup, metBoost: w.metBoost,
    });
  }
  coverage[icao] = cov;
  process.stderr.write(`${icao} ${CITIES[icao].name}: ${cov.tempDays} temperature days, ${cov.rainDays} rain days, ${cov.rainHours} rain hours, ${cov.windHours} wind hours, ${cov.gustHours} gust hours\n`);
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (s) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };

/** Day-block bootstrap of (mean loss of the blend − mean loss of each other contender). */
function bootDiffs(rows, ids, loss, blendId, seedKey) {
  const blocks = new Map();
  for (const r of rows) {
    const k = `${r.icao}|${r.date}`;
    let b = blocks.get(k);
    if (!b) { b = { n: 0, s: Object.fromEntries(ids.map((c) => [c, 0])) }; blocks.set(k, b); }
    b.n++;
    for (const c of ids) b.s[c] += loss(r, c);
  }
  const arr = [...blocks.values()];
  const others = ids.filter((c) => c !== blendId);
  const draws = Object.fromEntries(others.map((c) => [c, []]));
  const rng = mulberry32(seedOf(seedKey));
  for (let t = 0; t < BOOT && arr.length; t++) {
    let n = 0; const s = Object.fromEntries(ids.map((c) => [c, 0]));
    for (let j = 0; j < arr.length; j++) { const b = arr[Math.floor(rng() * arr.length)]; n += b.n; for (const c of ids) s[c] += b.s[c]; }
    for (const c of others) draws[c].push((s[blendId] - s[c]) / n);
  }
  const out = {};
  for (const c of others) {
    const v = draws[c].sort((x, y) => x - y);
    out[c] = v.length ? { lo: rnd(v[Math.floor(0.025 * v.length)], 5), hi: rnd(v[Math.min(v.length - 1, Math.floor(0.975 * v.length))], 5) } : null;
  }
  return out;
}

/** MAE / bias for continuous contenders, on the rows where every contender and the truth exist. */
function continuous(rows, ids, get, truth, { mainIds = null, blendId = 'blend', seedKey, dp = 2 } = {}) {
  const ok = rows.filter((r) => isNum(truth(r)) && ids.every((c) => isNum(get(r, c))));
  const out = { n: ok.length, scores: {} };
  if (!ok.length) return out;
  for (const c of ids) {
    const e = ok.map((r) => get(r, c) - truth(r));
    out.scores[c] = { mae: rnd(mean(e.map(Math.abs)), dp), bias: rnd(mean(e), dp), raw: rnd(mean(e.map(Math.abs)), 6) };
  }
  if (mainIds) {
    const credit = Object.fromEntries(mainIds.map((c) => [c, 0]));
    for (const r of ok) {
      const errs = mainIds.map((c) => Math.round(Math.abs(get(r, c) - truth(r)) * 100));
      const m = Math.min(...errs);
      const winners = mainIds.filter((_, k) => errs[k] === m);
      for (const c of winners) credit[c] += 1 / winners.length;
    }
    out.bestShare = Object.fromEntries(mainIds.map((c) => [c, pct(credit[c], ok.length)]));
    out.ci = bootDiffs(ok, mainIds, (r, c) => Math.abs(get(r, c) - truth(r)), blendId, seedKey);
  }
  return out;
}

/** Brier score, skill against the sample's own base rate, binned reliability and resolution. */
function probabilistic(rows, ids, getP, y, edges, { mainIds, blendId = 'blend', seedKey }) {
  const ok = rows.filter((r) => typeof y(r) === 'boolean' && ids.every((c) => isNum(getP(r, c))));
  const out = { n: ok.length, scores: {} };
  if (!ok.length) return out;
  const base = ok.filter(y).length / ok.length;
  out.baseRatePct = rnd(base * 100, 1);
  const unc = base * (1 - base);
  for (const c of ids) {
    const bs = mean(ok.map((r) => (getP(r, c) / 100 - (y(r) ? 1 : 0)) ** 2));
    const bins = edges.slice(0, -1).map((lo, k) => ({ lo, hi: edges[k + 1], n: 0, sumP: 0, hits: 0 }));
    for (const r of ok) {
      const pv = getP(r, c);
      const b = bins.find((x, k) => pv >= x.lo && (pv < x.hi || (k === bins.length - 1 && pv <= x.hi)));
      b.n++; b.sumP += pv / 100; if (y(r)) b.hits++;
    }
    let rel = 0, res = 0;
    for (const b of bins) if (b.n) { const f = b.sumP / b.n, o = b.hits / b.n; rel += b.n * (f - o) ** 2; res += b.n * (o - base) ** 2; }
    out.scores[c] = {
      brier: rnd(bs, 4), raw: rnd(bs, 6), bss: unc > 0 ? rnd(1 - bs / unc, 3) : null,
      reliability: rnd(rel / ok.length, 4), resolution: rnd(res / ok.length, 4),
      bins: bins.map((b) => ({ bin: `${b.lo}–${b.hi}`, n: b.n, meanP: b.n ? rnd((b.sumP / b.n) * 100, 1) : null, obsPct: b.n ? rnd((b.hits / b.n) * 100, 1) : null })),
    };
  }
  out.ci = bootDiffs(ok, mainIds, (r, c) => (getP(r, c) / 100 - (y(r) ? 1 : 0)) ** 2, blendId, seedKey);
  return out;
}

/** Yes/no at a line: hits, false alarms, misses; POD, FAR, CSI, frequency bias. */
function contingency(rows, ids, predict, y) {
  const ok = rows.filter((r) => typeof y(r) === 'boolean');
  const out = {};
  for (const c of ids) {
    let a = 0, b = 0, m = 0, n = 0;
    for (const r of ok) { const f = predict(r, c); if (f == null) continue; n++; if (f && y(r)) a++; else if (f) b++; else if (y(r)) m++; }
    out[c] = { n, hits: a, falseAlarms: b, misses: m, pod: pct(a, a + m), far: pct(b, a + b), csi: pct(a, a + b + m), freqBias: a + m ? rnd((a + b) / (a + m), 2) : null };
  }
  return out;
}

const cityKeys = Object.keys(CITIES);
const groups = [...cityKeys.map((k) => ({ key: k, name: CITIES[k].name, days: dayRows.filter((r) => r.icao === k), hours: hourRows.filter((r) => r.icao === k) })),
  { key: 'ALL', name: 'All six', days: dayRows, hours: hourRows }];

const MAIN = [...SRC, 'blend'];
const HOURLY_BINS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DAILY_BINS = [0, 20, 40, 60, 80, 100];
const results = {};
for (const g of groups) {
  const td = g.days.filter((r) => r.tempOk), rd = g.days.filter((r) => r.rainOk);
  const rh = g.hours.filter((r) => r.wxObserved);
  results[g.key] = {
    name: g.name,
    high: continuous(td, [...MAIN, 'blendFull', 'blendLate'], (r, c) => r.max[c], (r) => r.obsMax, { mainIds: MAIN, seedKey: `high|${g.key}` }),
    low: continuous(td, [...MAIN, 'blendFull', 'blendLate'], (r, c) => r.min[c], (r) => r.obsMin, { mainIds: MAIN, seedKey: `low|${g.key}` }),
    rainHourly: probabilistic(rh, MAIN, (r, c) => r.p[c], (r) => r.obsPrecip, HOURLY_BINS, { mainIds: MAIN, seedKey: `rainH|${g.key}` }),
    rainDaily: probabilistic(rd, [...MAIN, 'blendFull', 'blendLate'], (r, c) => r.rain[c], (r) => r.obsRain, DAILY_BINS, { mainIds: MAIN, seedKey: `rainD|${g.key}` }),
    yesNoHourly: {
      possible: contingency(rh, MAIN, (r, c) => (isNum(r.p[c]) ? r.p[c] >= RAIN_POSSIBLE_NOW_MIN_PROB : null), (r) => r.obsPrecip),
      rainNowPair: contingency(rh, MAIN, (r, c) => (isNum(r.p[c]) && isNum(r.mm[c]) ? r.p[c] >= RAIN_NOW_MIN_PROB && r.mm[c] >= RAIN_NOW_MIN_MM : null), (r) => r.obsPrecip),
    },
    yesNoDaily: Object.fromEntries(DAILY_RAIN_LINES.map((line) => [line, contingency(rd, [...MAIN, 'blendFull', 'blendLate'], (r, c) => (isNum(r.rain[c]) ? r.rain[c] >= line : null), (r) => r.obsRain)])),
    wind: continuous(g.hours, [...SRC, 'blendNow', 'blendHourly'], (r, c) => r.wind[c], (r) => r.obsWind, { mainIds: [...SRC, 'blendNow'], blendId: 'blendNow', seedKey: `wind|${g.key}` }),
    gust: continuous(g.hours, [...SRC, 'prod'], (r, c) => r.gust[c], (r) => r.obsGust, { mainIds: [...SRC, 'prod'], blendId: 'prod', seedKey: `gust|${g.key}` }),
  };
}

// ---------------------------------------------------------------------------
// Verdict: does the blend's score beat every single source's?
// ---------------------------------------------------------------------------
const METRICS = [
  { id: 'high', label: '(a) daily high — MAE °C', block: 'high', score: 'mae', blendId: 'blend', inputs: SRC, dp: 2, unit: '°C' },
  { id: 'low', label: '(b) daily low — MAE °C', block: 'low', score: 'mae', blendId: 'blend', inputs: ['OM', 'WA', 'PW'], dp: 2, unit: '°C' },
  { id: 'rainHourly', label: '(c) rain, hourly probability — Brier', block: 'rainHourly', score: 'brier', blendId: 'blend', inputs: ['OM', 'WA', 'MET', 'TI'], dp: 4, unit: '' },
  { id: 'rainDaily', label: '(c) rain, daily chance — Brier', block: 'rainDaily', score: 'brier', blendId: 'blend', inputs: SRC, dp: 4, unit: '' },
  { id: 'wind', label: '(d) wind, hourly mean — MAE km/h', block: 'wind', score: 'mae', blendId: 'blendNow', inputs: SRC, dp: 2, unit: 'km/h' },
  { id: 'gust', label: '(d) gust, hours with a METAR gust — MAE km/h', block: 'gust', score: 'mae', blendId: 'prod', inputs: ['OM', 'WA', 'PW'], dp: 2, unit: 'km/h' },
];
function verdictCell(m, g) {
  const blk = results[g][m.block];
  if (!blk || !blk.n) return { text: 'not scored', beatsAll: null };
  const sc = (c) => blk.scores[c]?.raw;   // unrounded, so a rounding tie cannot decide the verdict
  const b = sc(m.blendId);
  const mark = (c) => `${c}${m.inputs.includes(c) ? '' : '†'}`;
  const f = (v) => (Math.abs(v) < 0.5 * 10 ** -m.dp ? `< ${(10 ** -m.dp).toFixed(m.dp)}` : v.toFixed(m.dp));
  const better = SRC.filter((c) => sc(c) < b).sort((x, y) => sc(x) - sc(y));
  const noise = (c) => { const ci = blk.ci?.[c]; return ci && ci.lo <= 0 && ci.hi >= 0; };
  if (!better.length) {
    const next = SRC.slice().sort((x, y) => sc(x) - sc(y))[0];
    const margin = sc(next) - b;
    if (margin === 0) return { text: `tie with ${mark(next)}`, beatsAll: false, next };
    return { text: `**yes** — by ${f(margin)} over ${mark(next)}${noise(next) ? ' (within noise)' : ''}`, beatsAll: true, next, margin: rnd(margin, m.dp), noise: noise(next) };
  }
  const parts = better.map((c) => `${mark(c)} by ${f(b - sc(c))}${noise(c) ? ' (noise)' : ''}`);
  return { text: `**no** — ${parts.join('; ')}`, beatsAll: false, better: better.map((c) => ({ source: c, by: rnd(b - sc(c), m.dp), noise: noise(c), input: m.inputs.includes(c) })) };
}
const verdict = METRICS.map((m) => ({ metric: m.id, label: m.label, subject: m.blendId === 'prod' ? 'production\'s gust figure' : 'the blend', cells: Object.fromEntries(groups.map((g) => [g.key, verdictCell(m, g.key)])) }));

// ---------------------------------------------------------------------------
// Write JSON, hours CSV, Markdown
// ---------------------------------------------------------------------------
const outDir = path.join(ACCURACY_ROOT, 'results');
mkdirSync(outDir, { recursive: true });
const dayCols = ['icao', 'date', 'obsMax', 'obsMin', 'obsRain', 'dedup', 'metBoost',
  ...[...SRC, 'blend', 'blendFull', 'blendLate'].flatMap((c) => [`max_${c}`, `min_${c}`, `rain_${c}`])];
const json = {
  generatedAt: new Date().toISOString(), range: RANGE, requestHour: REQ_HOUR, lateHour: LATE_HOUR, bootstrapDraws: BOOT,
  rules: { temperature: TEMP_RULE, rainDay: RAIN_DAY_RULE, hourlyPossibleLine: RAIN_POSSIBLE_NOW_MIN_PROB, hourlyRainNowPair: { prob: RAIN_NOW_MIN_PROB, mm: RAIN_NOW_MIN_MM }, dailyLines: DAILY_RAIN_LINES },
  standIns: Object.fromEntries(SRC.map((c, k) => [c, SLOT_KEYS[k]])),
  coverage, standInIdentity: identity, results, verdict,
  days: { columns: dayCols, rows: dayRows.map((r) => [r.icao, r.date, r.obsMax, r.obsMin, r.obsRain, r.dedup, r.metBoost, ...[...SRC, 'blend', 'blendFull', 'blendLate'].flatMap((c) => [rnd(r.max[c], 1), rnd(r.min[c], 1), rnd(r.rain[c], 1)])]) },
};
// Reliability bins are kept for all six only (the report's tables). Anything short enough
// sits on one line (one contender's scores, one scored day), so the file reads as tables.
const slim = JSON.parse(JSON.stringify(results));
for (const [g, r] of Object.entries(slim)) if (g !== 'ALL') for (const blk of [r.rainHourly, r.rainDaily]) for (const s of Object.values(blk.scores || {})) delete s.bins;
function pretty(v, ind = '') {
  const flat = JSON.stringify(v);
  if (v === null || typeof v !== 'object' || flat.length <= 140) return flat;
  const next = `${ind} `;
  if (Array.isArray(v)) return `[\n${v.map((x) => next + pretty(x, next)).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${next}${JSON.stringify(k)}: ${pretty(x, next)}`).join(',\n')}\n${ind}}`;
}
writeFileSync(path.join(outDir, 'blend-vs-sources.json'), pretty({ ...json, results: slim }) + '\n');

const hCols = ['icao', 'time', 'wxObserved', 'obsPrecip', 'obsWind', 'obsGust', 'obsWindy', 'dedup', 'metBoost',
  ...[...SRC, 'blend'].map((c) => `p_${c}`), ...[...SRC, 'blend'].map((c) => `mm_${c}`),
  ...[...SRC, 'blendNow', 'blendHourly'].map((c) => `wind_${c}`), ...[...SRC, 'prod'].map((c) => `gust_${c}`)];
const hLine = (r) => [r.icao, r.time, r.wxObserved, r.obsPrecip, r.obsWind, r.obsGust, r.obsWindy, r.dedup, r.metBoost,
  ...[...SRC, 'blend'].map((c) => r.p[c]), ...[...SRC, 'blend'].map((c) => r.mm[c]),
  ...[...SRC, 'blendNow', 'blendHourly'].map((c) => r.wind[c]), ...[...SRC, 'prod'].map((c) => r.gust[c])].map((v) => (v ?? '')).join(',');
writeFileSync(path.join(outDir, 'blend-vs-sources-hours.csv'), [hCols.join(','), ...hourRows.map(hLine)].join('\n'));

// ---- Markdown ----
const G = groups.map((g) => g.key);
const head = (first) => [`| ${first} | ${groups.map((g) => g.name).join(' | ')} |`, `|---|${groups.map(() => '---').join('|')}|`];
const f2 = (v, dp = 2) => (isNum(v) ? v.toFixed(dp) : '—');
const sgn = (v, dp = 1) => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(dp)}` : '—');
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const md = [];
md.push('# Blend vs sources — does the blend beat every single source it blends?', '');
md.push(`Generated ${json.generatedAt} by \`review/accuracy/blend-vs-sources.mjs\`. ${RANGE.from} → ${RANGE.to}, six SA airports, METAR ground truth, the five archived stand-ins of \`lib/sources.mjs\`, and the blend production computes from them. REPORT ONLY — no weight or threshold was changed.`, '');

md.push('## Verdict', '');
md.push(`A cell is **yes** when the blend\'s score is better than every one of the five sources\' — for the high, low and daily rain: the day-0 blend as served at ${hh(REQ_HOUR)}; for hourly rain: the current hour\'s blended % (\`hourly[localHour].rainChance\`, the now-ladder\'s input) at every hour; for wind: \`now.windKph\`; for gusts: production\'s gust figure (the largest of Open-Meteo, WeatherAPI and Pirate). "by" is the margin in the metric\'s unit (°C, km/h, Brier). **(noise)** = the day-block bootstrap 95% interval of the difference includes zero: the sample cannot tell the two apart. † = a source that is not an input to that blend (Pirate has no hourly slot; MET Norway and Tomorrow.io carry no weight in the low; production reads no gust from them).`, '');
md.push('On rain the WeatherAPI stand-in\'s probability is Open-Meteo\'s own (identical at every hour), so OM and WA always score alike there.', '');
md.push(...head('metric'));
for (const v of verdict) md.push(`| ${v.label} | ${G.map((g) => v.cells[g].text).join(' | ')} |`);
md.push('');

// Read-out — sentences built from the numbers above, nothing added by hand.
{
  const R = results.ALL;
  const clearLoss = (v) => cityKeys.filter((k) => v.cells[k].beatsAll === false && v.cells[k].better?.some((b) => !b.noise))
    .map((k) => `${CITIES[k].name} (${v.cells[k].better.filter((b) => !b.noise).map((b) => `${b.source}${b.input ? '' : '†'}`).join(', ')})`);
  md.push('### Read-out', '');
  for (const v of verdict) {
    const scored = cityKeys.filter((k) => v.cells[k].beatsAll !== null);
    const yes = scored.filter((k) => v.cells[k].beatsAll === true);
    const cl = clearLoss(v);
    md.push(`- ${v.label.replace(/ — .*/, '')}: ${v.subject} beats every source at **${yes.length} of ${scored.length}** airports; all six pooled: ${v.cells.ALL.text}. ${cl.length ? `Losses the sample can see (outside noise): ${cl.join('; ')}.` : 'No loss the sample can tell from noise.'}`);
  }
  const h = R.high.scores, l = R.low.scores;
  const windowsNotWeights = Math.abs(h.blendFull.raw - h.blend.raw) < 0.05 && h.blendLate.raw - h.blend.raw > 0.1;
  md.push(`- The day\'s high read in the evening: at ${hh(LATE_HOUR)} the same day-0 blend has MAE ${f2(h.blendLate.mae)} °C (bias ${sgn(h.blendLate.bias)}) against ${f2(h.blend.mae)} (${sgn(h.blend.bias)}) at ${hh(REQ_HOUR)}; by then MET\'s high has dropped out and Tomorrow.io\'s "today" is only the evening. Every slot fed its full calendar day gives ${f2(h.blendFull.mae)}${windowsNotWeights ? ' — the weighting rules are identical in all three rows, so the evening loss comes from the windows (Tomorrow.io\'s evening-only "high", MET\'s high gone)' : ''}.`);
  const pwFABL = results.FABL?.low?.scores?.PW;
  md.push(`- The blended low (MAE ${f2(l.blend.mae)} °C, bias ${sgn(l.blend.bias)}) is ${l.blend.raw > l.OM.raw ? 'worse' : 'better'} than Open-Meteo\'s low alone (${f2(l.OM.mae)}, ${sgn(l.OM.bias)}). It blends only OM, WA and PW (LOW_WEIGHTS); the PW stand-in\'s lows have bias ${sgn(l.PW.bias)} over all six${pwFABL ? ` and ${sgn(pwFABL.bias)} at Bloemfontein` : ''}, the WA stand-in\'s ${sgn(l.WA.bias)}. Whether the real Pirate Weather carries the GFS stand-in\'s night-time error is not shown here.`);
  const allLow = cityKeys.filter((k) => SRC.every((c) => results[k].wind.scores[c]?.bias < -3));
  if (allLow.length) md.push(`- Wind: at ${allLow.map((k) => `${CITIES[k].name} (source biases ${sgn(Math.min(...SRC.map((c) => results[k].wind.scores[c].bias)))} to ${sgn(Math.max(...SRC.map((c) => results[k].wind.scores[c].bias)))} km/h)`).join(' and ')} every source reads under the airport anemometer. A weighted mean of five low numbers is still low, so there the least-low source beats the blend; elsewhere the blend wins.`);
  const topShare = MAIN.filter((c) => c !== 'blend').sort((a, b) => R.high.bestShare[b] - R.high.bestShare[a])[0];
  md.push(`- The blend is closest to the observed high on ${R.high.bestShare.blend}% of days (the most often closest is ${topShare}, ${R.high.bestShare[topShare]}%). An average is rarely the nearest on a given day; what it can win is the size of the misses, which is what MAE and Brier measure.`);
  const dd = dayRows.filter((r) => r.dedup).length;
  const mb = dayRows.filter((r) => r.metBoost).length;
  md.push(`- Production\'s weight adjustments at ${hh(REQ_HOUR)}: the ECMWF dedup halved WeatherAPI on ${dd} of ${dayRows.length} days; the MET boost fired on ${mb} (${cityKeys.filter((k) => dayRows.some((r) => r.icao === k && r.metBoost)).map((k) => CITIES[k].name).join(', ') || 'none'}).${mb < 10 ? ' With the UKMO stand-in in MET\'s slot the boost is nearly idle, so this backtest says little about it.' : ''}`, '');
}

md.push('## Method', '');
md.push(`- **Truth.** METAR (\`lib/obs.mjs\`), one report per local hour (the top-of-hour report when present). Daily max/min = the highest/lowest of those hourly temperatures (whole °C) on the local SAST day — the same hourly sampling the models' daily max/min use. A day is scored for temperature when ≥ ${TEMP_RULE.minHours} of its 24 hours carry a temperature and at least one falls in ${hh(TEMP_RULE.minWindow[0])}–${String(TEMP_RULE.minWindow[1]).padStart(2, '0')}:59 (where the minimum usually is) and in ${hh(TEMP_RULE.maxWindow[0])}–${String(TEMP_RULE.maxWindow[1]).padStart(2, '0')}:59 (the maximum).`);
md.push('- **Rain truth.** "Precipitation reported that hour" is `lib/obs.mjs`\'s definition (RA/DZ/SN/SG/PL/GR/GS/UP in any report of the hour, not VC, not RE). An hour whose every report has `//` in the present-weather slot (an AUTO report without a present-weather sensor) observed nothing and is **not scored**; a day is scored for rain when ≥ 18 of its hours have a report and none of them is such an hour.');
md.push(`- **Sources.** Each stand-in on its own: daily max/min of its hourly temperatures on the local calendar day; hourly probability as production carries it for that slot (Open-Meteo, WeatherAPI, Tomorrow.io native %, MET Norway the mm → % proxy ladder, api/weather.js:1683–1687; Pirate\'s own % for reference only); daily chance = the day\'s maximum hourly % (Open-Meteo: \`precipitation_probability_max\`; MET: the daily mm ladder, :1597–1602), over the full calendar day; wind = hourly \`wind_speed_10m\` and \`wind_gusts_10m\`.`);
md.push(`- **The blend** is production\'s arithmetic, copied from the handler with line numbers: base weights OM 0.30 · WA 0.22 · PW 0.13 · MET 0.20 · TI 0.15 (:876); WeatherAPI halved when its day high is within 0.5 °C of Open-Meteo\'s (:1889–1896); outside the Highveld (lat > −28 and lon > 25), MET → 0.40 and OM → 0.25 when MET\'s day high is > 5 °C above the OM/WA average (:1903–1917); hourly weights re-normalised over OM, WA, MET, TI (:1924–1926); the low blended with LOW_WEIGHTS — MET and Tomorrow.io at zero, the WeatherAPI halving kept (:1974); \`resolveWeights\` (:1935) and \`wAvg\` (:1978), rounding to 0.1 included. The adjustments are decided **per day** from that day\'s highs, and per hour for the hourly blends (MET\'s high drops out at noon, so the MET boost can only fire before it).`);
md.push(`- **What each slot feeds day 0** when the app is opened at ${hh(REQ_HOUR)}: Open-Meteo and WeatherAPI the calendar day; Pirate its daytime high (\`temperatureHigh\`, 06:01–18:00 in Pirate\'s documentation, :1456) and calendar-day minimum (:1445); MET Norway now → midnight, and nothing once fewer than 12 of today\'s hours remain (:1614–1647); Tomorrow.io now → midnight whatever is left (:1774–1780). "Full-day inputs" feeds every slot its calendar day instead (weighting only); "as served at ${hh(LATE_HOUR)}" is the same day-0 blend read in the evening.`);
md.push(`- **Hourly blends** (rain %, mm, the hourly-strip wind) use the four hourly slots — Pirate has none (:866–867); \`now.windKph\` blends all five current winds with the source weights (:2251). Production\'s gust figure is the largest of Open-Meteo\'s, WeatherAPI\'s and Pirate\'s (:2264–2265); MET and Tomorrow.io publish none (:1656, :1792).`);
md.push(`- **Noise.** 95% intervals from ${BOOT} day-block bootstrap draws (whole days resampled, so an hourly score\'s within-day correlation is kept).`, '');

md.push('## Coverage and how often production\'s weight adjustments fired', '');
md.push('| | ' + cityKeys.map((k) => CITIES[k].name).join(' | ') + ' |', '|---|' + cityKeys.map(() => '---').join('|') + '|');
md.push(`| days scored, temperature | ${cityKeys.map((k) => coverage[k].tempDays).join(' | ')} |`);
md.push(`| days scored, rain | ${cityKeys.map((k) => `${coverage[k].rainDays}${coverage[k].rainDaysDroppedUnobserved ? ` (${coverage[k].rainDaysDroppedUnobserved} dropped: unobserved hours)` : ''}`).join(' | ')} |`);
md.push(`| hours scored, rain | ${cityKeys.map((k) => `${coverage[k].rainHours}${coverage[k].rainHoursUnobserved ? ` (${coverage[k].rainHoursUnobserved} unobserved)` : ''}`).join(' | ')} |`);
md.push(`| hours scored, wind / with a gust group | ${cityKeys.map((k) => `${coverage[k].windHours} / ${coverage[k].gustHours}`).join(' | ')} |`);
md.push(`| WeatherAPI halved (ECMWF dedup), days at ${hh(REQ_HOUR)} | ${cityKeys.map((k) => `${dayRows.filter((r) => r.icao === k && (r.tempOk || r.rainOk) && r.dedup).length}`).join(' | ')} |`);
md.push(`| MET boost fired, days at ${hh(REQ_HOUR)} / hours | ${cityKeys.map((k) => `${dayRows.filter((r) => r.icao === k && (r.tempOk || r.rainOk) && r.metBoost).length} / ${coverage[k].boostHours}`).join(' | ')} |`);
md.push('');

const matrix = (title, block, ids, cell, extraRows = [], labels = {}) => {
  md.push(title, '');
  md.push(...head(''));
  for (const [label, fn] of extraRows) md.push(`| ${label} | ${G.map((g) => fn(results[g][block])).join(' | ')} |`);
  for (const c of ids) md.push(`| ${labels[c] ?? LABEL[c]} | ${G.map((g) => (results[g][block]?.scores?.[c] ? cell(results[g][block].scores[c], results[g][block]) : '—')).join(' | ')} |`);
  md.push('');
};
const HOURLY_BLEND_LABEL = { blend: '**blend, the current hour (`hourly[localHour].rainChance`)**' };
const shareRows = (block, ids) => {
  md.push(...head('share of days closest to the observation (ties split)'));
  for (const c of ids) md.push(`| ${LABEL[c]} | ${G.map((g) => (isNum(results[g][block]?.bestShare?.[c]) ? `${results[g][block].bestShare[c]}%` : '—')).join(' | ')} |`);
  md.push('');
};

md.push('## (a) Daily high', '');
matrix('MAE °C (bias: forecast − observed)', 'high', [...MAIN, 'blendFull', 'blendLate'], (s) => `${f2(s.mae)} (${sgn(s.bias)})`, [['days', (b) => b.n]]);
shareRows('high', MAIN);
md.push('## (b) Daily low', '');
md.push('The three blend rows are identical by construction: LOW_WEIGHTS (:1974) gives MET Norway and Tomorrow.io no weight, so their windows never reach the low.', '');
matrix('MAE °C (bias: forecast − observed)', 'low', [...MAIN, 'blendFull', 'blendLate'], (s) => `${f2(s.mae)} (${sgn(s.bias)})`, [['days', (b) => b.n]]);
shareRows('low', MAIN);

md.push('## (c) Rain', '');
matrix(`### Hourly probability — Brier score (skill against the sample\'s own rain frequency). Lower Brier is better. PW† is not in the hourly blend (no hourly slot); MET is its mm → % proxy; WA\'s stand-in probability is OM\'s own`, 'rainHourly', MAIN, (s) => `${f2(s.brier, 4)} (${sgn(s.bss, 3)})`, [['hours', (b) => b.n], ['hours with rain', (b) => (isNum(b.baseRatePct) ? `${b.baseRatePct}%` : '—')]], HOURLY_BLEND_LABEL);
{
  const all = results.ALL.rainHourly;
  md.push('Reliability, all six (forecast bin → share of those hours with rain reported; n):', '');
  md.push(`| forecast % | ${MAIN.map((c) => c === 'blend' ? '**blend**' : c).join(' | ')} |`, `|---|${MAIN.map(() => '---').join('|')}|`);
  for (let k = 0; k < HOURLY_BINS.length - 1; k++) md.push(`| ${all.scores.OM.bins[k].bin} | ${MAIN.map((c) => { const b = all.scores[c].bins[k]; return b.n ? `${b.obsPct}% (${b.n})` : '—'; }).join(' | ')} |`);
  md.push(`| reliability term (lower = better calibrated) | ${MAIN.map((c) => f2(all.scores[c].reliability, 4)).join(' | ')} |`);
  md.push(`| resolution term (higher = sharper separation) | ${MAIN.map((c) => f2(all.scores[c].resolution, 4)).join(' | ')} |`, '');
}
{
  const yn = results.ALL.yesNoHourly;
  md.push(`Yes/no at the now-ladder\'s own lines, all six: **might rain** = hour % ≥ ${RAIN_POSSIBLE_NOW_MIN_PROB} (\`RAIN_POSSIBLE_NOW_MIN_PROB\`); **rain-now pair** = % ≥ ${RAIN_NOW_MIN_PROB} **and** ≥ ${RAIN_NOW_MIN_MM} mm (\`RAIN_NOW_MIN_PROB\`, \`RAIN_NOW_MIN_MM\`) — the numeric half of the rain-now rung; its third condition, ≥ 2 sources describing rain, is not a per-source quantity and is scored with the whole resolver in \`run-eval.mjs\`. MET\'s % is its mm proxy, so its pair is simply ≥ 1 mm.`, '');
  md.push('| line | contender | POD (rain hours caught) | FAR (yes-hours dry) | CSI | frequency bias | hits / false alarms / misses |', '|---|---|---|---|---|---|---|');
  for (const [name, t] of [['might rain ≥ ' + RAIN_POSSIBLE_NOW_MIN_PROB + '%', yn.possible], [`rain-now pair ≥ ${RAIN_NOW_MIN_PROB}% & ≥ ${RAIN_NOW_MIN_MM} mm`, yn.rainNowPair]]) {
    for (const c of MAIN) md.push(`| ${name} | ${c === 'blend' ? '**blend**' : c} | ${t[c].pod}% | ${t[c].far}% | ${t[c].csi}% | ${f2(t[c].freqBias)} | ${t[c].hits} / ${t[c].falseAlarms} / ${t[c].misses} |`);
  }
  md.push('');
  md.push(...head('might-rain line, CSI by city'));
  for (const c of MAIN) md.push(`| ${HOURLY_BLEND_LABEL[c] ?? LABEL[c]} | ${G.map((g) => (isNum(results[g].yesNoHourly.possible[c].csi) ? `${results[g].yesNoHourly.possible[c].csi}%` : '—')).join(' | ')} |`);
  md.push('');
}
matrix(`### Daily chance against "precipitation reported that day" — Brier (skill). Sources: their own calendar-day figure; the blend: as served at ${hh(REQ_HOUR)} (MET and Tomorrow.io then cover ${hh(REQ_HOUR)}–24:00)`, 'rainDaily', [...MAIN, 'blendFull', 'blendLate'], (s) => `${f2(s.brier, 4)} (${sgn(s.bss, 3)})`, [['days', (b) => b.n ?? 0], ['days with rain', (b) => (isNum(b.baseRatePct) ? `${b.baseRatePct}%` : '—')]]);
{
  const all = results.ALL.rainDaily;
  if (all.n) {
    md.push('Reliability, all scored days (forecast bin → share of those days with rain reported; n):', '');
    md.push(`| forecast % | ${MAIN.map((c) => c === 'blend' ? '**blend**' : c).join(' | ')} |`, `|---|${MAIN.map(() => '---').join('|')}|`);
    for (let k = 0; k < DAILY_BINS.length - 1; k++) md.push(`| ${all.scores.OM.bins[k].bin} | ${MAIN.map((c) => { const b = all.scores[c].bins[k]; return b.n ? `${b.obsPct}% (${b.n})` : '—'; }).join(' | ')} |`);
    md.push(`| reliability term | ${MAIN.map((c) => f2(all.scores[c].reliability, 4)).join(' | ')} |`);
    md.push(`| resolution term | ${MAIN.map((c) => f2(all.scores[c].resolution, 4)).join(' | ')} |`, '');
    md.push(`Yes/no at the daily ladder\'s rain lines (≥ 30% → rain, :3407; ≥ 60% → rain, :3398), all scored days:`, '');
    md.push('| line | contender | POD | FAR | CSI | frequency bias | hits / false alarms / misses |', '|---|---|---|---|---|---|---|');
    for (const line of DAILY_RAIN_LINES) for (const c of [...MAIN, 'blendFull', 'blendLate']) { const t = results.ALL.yesNoDaily[line][c]; md.push(`| ≥ ${line}% | ${c === 'blend' ? '**blend**' : c === 'blendFull' ? 'blend, full-day inputs' : c === 'blendLate' ? `blend at ${hh(LATE_HOUR)}` : c} | ${t.pod}% | ${t.far}% | ${t.csi}% | ${f2(t.freqBias)} | ${t.hits} / ${t.falseAlarms} / ${t.misses} |`); }
    md.push('');
  }
}

md.push('## (d) Wind', '');
matrix('### Hourly mean wind — MAE km/h (bias: forecast − METAR 10-minute mean)', 'wind', [...SRC, 'blendNow', 'blendHourly'], (s) => `${f2(s.mae)} (${sgn(s.bias)})`, [['hours', (b) => b.n]]);
matrix('### Gusts — MAE km/h (bias), only the hours whose METAR carries a gust group (reported when gusts exceed the mean by ≥ 10 kt, so this is the gusty tail, not all hours). MET† and TI† gusts exist in the archive but production reads none', 'gust', [...SRC, 'prod'], (s) => `${f2(s.mae)} (${sgn(s.bias)})`, [['hours', (b) => b.n]]);

md.push('## What the stand-ins cannot show', '');
const idAll = Object.values(identity).reduce((a, x) => ({ h: a.h + x.hours, pp: a.pp + x.omWaProbIdentical, mm: a.mm + x.omWaMmIdentical, uk: a.uk + x.ukmoProbNonZero }), { h: 0, pp: 0, mm: 0, uk: 0 });
md.push(`- **Four of the five sources are approximations.** Only Open-Meteo is the production provider itself (same endpoint family and variables). WeatherAPI is stood in for by ECMWF IFS 0.25°, Pirate Weather by GFS, MET Norway by the UK Met Office global model, Tomorrow.io by ICON (\`lib/sources.mjs\`). None of them carries the real provider\'s own post-processing, blending or vocabulary.`);
md.push(`- **The WeatherAPI stand-in adds nothing independent on rain.** Its hourly probability is identical to Open-Meteo\'s in ${idAll.pp} of ${idAll.h} hours (both are the archive\'s ECMWF-ensemble probability) and its amount in ${idAll.mm}; its temperatures do differ. Real WeatherAPI has its own \`chance_of_rain\`, its "Patchy rain possible" habit and the code-1000/1003 clamps (:1321, :1339–1342, :1373–1377) — none reproduced.`);
md.push(`- **The MET Norway stand-in is more independent than MET Norway is.** MET\'s Locationforecast uses ECMWF\'s high-resolution model everywhere outside the Nordic region (MET\'s own documentation), so in production MET, Open-Meteo and — by the handler\'s own assumption — WeatherAPI may all be ECMWF underneath: the live blend has less model diversity than this backtest, which should shrink any averaging benefit measured here. The UKMO stand-in also has **no probability field** (its archived \`precipitation_probability\` is 0 in ${idAll.h - idAll.uk} of ${idAll.h} hours), so it is scored the way production scores MET: its amount through the mm → % ladder.`);
md.push('- **Pirate Weather** is NOAA GFS/GEFS with Pirate\'s own processing; its daily `precipProbability` is a GEFS ensemble figure, stood in for by the day\'s maximum hourly GFS-derived %. Its daytime-window high (06:01–18:00) is reproduced in the blend input.');
md.push('- **Tomorrow.io\'s radar is absent.** Its `precipitationIntensity` is radar-informed and drives the override (current hour > 0.5 mm/h → rain); there is no radar archive, so neither the override nor the radar-shaped hourly amounts are in this backtest (ICON\'s model amounts stand in). The live sample caught the override firing at Johannesburg under a CAVOK METAR.');
md.push('- **"Now" values are forecast hours here.** Production\'s current wind, temperature and description come from each provider\'s current-conditions block (WeatherAPI\'s is station-influenced, Open-Meteo\'s a 15-minute value, MET\'s the first forecast step); the stand-ins can only offer the forecast value for that hour.');
md.push(`- **Archive, not the forecast the app showed.** Open-Meteo\'s historical-forecast archive stitches together the first hours of each successive model run, so every hour here is a short-lead forecast (a few hours old). The app at ${hh(REQ_HOUR)} showed the afternoon from older runs; real errors are larger than these, and whether blending helps more or less at longer leads is not measured here.`);
md.push(`- **Production\'s day-0 windows change through the day.** The morning read (${hh(REQ_HOUR)}) is scored; the "${hh(LATE_HOUR)}" rows show the same blend in the evening, when MET\'s high has dropped out and Tomorrow.io\'s "today" is only the evening hours.`);
md.push('- **An airport is not the city, and a grid cell is not a point.** FACT is on the Cape Flats, not in Strand; FALE (King Shaka) is some 35 km north of central Durban; FAOR is out on the Highveld east of Johannesburg. Each model answers for its own grid cell (the archive snaps each model to its grid point; e.g. the stand-ins for Gqeberha sit at −33.91, 25.55 against the runway at −33.98, 25.62). A 9–25 km cell\'s rain probability is expected to exceed the rain frequency at one point — for every source alike.');
md.push(`- **METAR sampling.** Hourly whole-degree temperatures (the true extremes fall between reports); present weather only at report time (a shower between reports is seen only if a special report was issued); no rain amounts in SA METARs, so amounts can only be scored as yes/no; Bloemfontein\'s overnight AUTO reports (21:00–05:00 SAST, ${coverage.FABL?.rainHoursUnobserved ?? 0} hours) observe no present weather — those hours are not scored and **no Bloemfontein day can be scored for daily rain**; gusts appear only when they exceed the mean by ≥ 10 kt.`);
md.push('- **Hour alignment.** The archive\'s hour-T values describe the hour ending at T (Open-Meteo convention); the METAR hour T holds the T:00 report and any specials to T:59; production\'s own MET and WeatherAPI hourly values describe the hour starting at T. The offset is the same for every stand-in, so it cannot favour one — it does blur every hourly rain score a little.');
md.push(`- **One winter.** ${RANGE.from} → ${RANGE.to}: Cape frontal rain, a dry Highveld winter, no summer convection. The ranking may differ in summer.`);
md.push('- **The existing replay (`lib/replay.mjs`) differs from production in two places this script does not share:** it blends the day-0 low with the high\'s weights (production uses LOW_WEIGHTS, :1974–1975, :2069), and it feeds MET and Tomorrow.io their full-day high/low at every hour (production: MET null after ~12:00, Tomorrow.io rest-of-day). Its line citations also predate a ~20-line shift in api/weather.js (e.g. base weights now :876, not :856).', '');

md.push('## Files', '');
md.push('- `review/accuracy/blend-vs-sources.mjs` — this measurement (`node review/accuracy/blend-vs-sources.mjs`, a few seconds; `--hour`, `--late`, `--boot` change the read hours and the draws).');
md.push('- `results/blend-vs-sources.json` — every number above, the bootstrap intervals, and every scored day (`days.columns` / `days.rows`).');
md.push('- `results/blend-vs-sources-hours.csv` — every scored hour with each source, the blends and the observation (git-ignored, regenerated).');
md.push('- `results/live-sample-2026-09-23.md` / `.json` — one live read of production at the six airports (an anecdote).', '');
writeFileSync(path.join(outDir, 'blend-vs-sources.md'), md.join('\n') + '\n');
process.stderr.write(`wrote results/blend-vs-sources.md, .json, -hours.csv (${dayRows.length} days, ${hourRows.length} hours)\n`);
