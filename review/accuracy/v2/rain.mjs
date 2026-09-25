// RAIN — today, and in the next 3 hours: how right, and how honest is the %?
//   node review/accuracy/v2/rain.mjs
// Truth: METAR present weather (rain, drizzle, showers, thunderstorm with rain) at the scored airports
// that report present weather (not FALW, FAHS, FAWB; FAEL only by day). Forecasts (proxy-free):
//   · Open-Meteo's own % (best_match, short-lead archive) — what production's Open-Meteo source says;
//   · the five models' amounts (real past forecasts, latest run t0; ECMWF once) — the share calling rain;
//   · the app's own % replayed from what the archives hold: Open-Meteo's %, ECMWF's and GFS's % in the
//     WeatherAPI and Pirate slots, MET Norway's mm→% ladder on ECMWF's amounts, production's weights
//     (Tomorrow.io has no archive: left out, the weights renormalise) — a proxy, said so wherever shown.
// Calibration curves (isotonic) and the mix are learned on TRAIN (2025); every number is on TEST (2026).
import { mkdirSync, writeFileSync } from 'node:fs';
// 7-day bootstrap blocks (weather regimes last several days), as in temps.mjs.
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
import path from 'node:path';
import { SCORED, PERIOD } from './stations.mjs';
import { CONS } from './tempcore.mjs';
import { metHourlyRainProxy, metDailyRainProxy } from '../lib/sources.mjs';
import { loadObs, loadRuns, loadHist, days, hourKey, TRAIN, TEST, inRange, isNum, mean, round, bootDiff, isotonic, applyCurve, RESULTS } from './lib.mjs';

const NO_WX = new Set(['FALW', 'FAHS', 'FAWB']);          // no present-weather group → no rain truth
const DAY_ONLY = new Set(['FAEL']);                         // no night reports
const RAIN_STATIONS = SCORED.filter((s) => !NO_WX.has(s.id));
const DAY_MM = 0.5, HOUR_MM = 0.1;                          // a model "calls rain" at these amounts

const rainAt = (obs, day, h) => {                           // rain during the hour ending at h (OM's convention)
  const r = obs.get(hourKey(day, h));
  const prevKey = h === 0 ? hourKey(new Date(Date.parse(`${day}T00:00:00Z`) - 86400e3).toISOString().slice(0, 10), 23) : hourKey(day, h - 1);
  const p = obs.get(prevKey);
  if (!r && !p) return null;
  return Boolean(r?.precip || p?.precipAnyReport);
};

const daysOut = [], windowsOut = [];
for (const st of RAIN_STATIONS) {
  const obs = loadObs(st.id);
  const runs = Object.fromEntries(CONS.map((m) => [m, loadRuns(st.id, m)]).filter(([, v]) => v));
  const bm = loadHist(st.id, 'best_match'), ec = loadHist(st.id, 'ecmwf_ifs025'), gf = loadHist(st.id, 'gfs_seamless');
  if (Object.keys(runs).length < CONS.length || !bm || !ec || !gf) { console.error(`${st.id}: data missing`); continue; }
  // production's daily weights [OM, WA, PW, MET] (Tomorrow.io left out) and hourly [OM, WA, MET]
  const wavg = (vals, w) => { let a = 0, b = 0; vals.forEach((v, i) => { if (isNum(v)) { a += v * w[i]; b += w[i]; } }); return b ? a / b : null; };
  const maxPp = (H, hs) => { const v = hs.map((h) => H.get(hourKey(d, h))?.pp).filter(isNum); return v.length ? Math.max(...v) : null; };
  let d;
  for (d of days(PERIOD.from, PERIOD.to)) {
    // ---- the day ----
    const hrs = DAY_ONLY.has(st.id) ? [...Array(15).keys()].map((i) => i + 6) : [...Array(24).keys()];
    const obsH = hrs.map((h) => rainAt(obs, d, h));
    const seen = obsH.filter((x) => x !== null).length;
    if (seen >= hrs.length * 0.75) {
      const rained = obsH.some(Boolean);
      const omPct = Math.max(...hrs.map((h) => bm.get(hourKey(d, h))?.pp ?? -1));
      const share = mean(CONS.map((m) => (hrs.reduce((s, h) => s + (runs[m].get(hourKey(d, h))?.p0 ?? 0), 0) >= DAY_MM ? 1 : 0)));
      const metMm = Math.max(...hrs.filter((h) => h >= 6).map((h) => runs.best_match.get(hourKey(d, h))?.p0 ?? 0));
      const appPct = wavg([maxPp(bm, hrs), maxPp(ec, hrs), maxPp(gf, hrs), metDailyRainProxy(metMm)], [0.30, 0.22, 0.13, 0.20]);
      daysOut.push({ id: st.id, region: st.region, day: d, rained, omPct: omPct >= 0 ? omPct : null, share, appPct });
    }
    // ---- the next 3 hours, read at 06, 09, 12, 15, 18 ----
    for (const h0 of [6, 9, 12, 15, 18]) {
      const win = [h0 + 1, h0 + 2, h0 + 3];
      const o = win.map((h) => rainAt(obs, d, h));
      if (o.some((x) => x === null)) continue;
      const omPct = Math.max(...win.map((h) => bm.get(hourKey(d, h))?.pp ?? -1));
      const share = mean(CONS.map((m) => (win.some((h) => (runs[m].get(hourKey(d, h))?.p0 ?? 0) >= HOUR_MM) ? 1 : 0)));
      const appPct = Math.max(...win.map((h) => wavg([bm.get(hourKey(d, h))?.pp, ec.get(hourKey(d, h))?.pp, metHourlyRainProxy(runs.best_match.get(hourKey(d, h))?.p0)], [0.345, 0.253, 0.230]) ?? -1));
      windowsOut.push({ id: st.id, region: st.region, day: d, h0, rained: o.some(Boolean), omPct: omPct >= 0 ? omPct : null, share, appPct: appPct >= 0 ? appPct : null });
    }
  }
}

function evaluate(rows, label) {
  const train = rows.filter((r) => inRange(r.day, TRAIN) && isNum(r.omPct));
  const test = rows.filter((r) => inRange(r.day, TEST) && isNum(r.omPct));
  const y = (r) => (r.rained ? 1 : 0);
  const curveOM = isotonic(train.map((r) => r.omPct / 100), train.map(y));
  const curveShare = isotonic(train.map((r) => r.share), train.map(y));
  // the mix: average of the two calibrated probabilities, recalibrated
  const mixRaw = (r) => (applyCurve(curveOM, r.omPct / 100) + applyCurve(curveShare, r.share)) / 2;
  const curveMix = isotonic(train.map(mixRaw), train.map(y));
  const curveApp = isotonic(train.filter((r) => isNum(r.appPct)).map((r) => r.appPct / 100), train.filter((r) => isNum(r.appPct)).map(y));
  const methods = {
    "the app's % (proxy)": (r) => (isNum(r.appPct) ? r.appPct / 100 : r.omPct / 100),
    "the app's %, calibrated": (r) => applyCurve(curveApp, isNum(r.appPct) ? r.appPct / 100 : r.omPct / 100),
    "Open-Meteo's own %": (r) => r.omPct / 100,
    "Open-Meteo's %, calibrated": (r) => applyCurve(curveOM, r.omPct / 100),
    'share of 6 models, calibrated': (r) => applyCurve(curveShare, r.share),
    'both, calibrated': (r) => applyCurve(curveMix, mixRaw(r)),
  };
  const res = { label, n: test.length, base: mean(test.map(y)), methods: {}, curves: { om: curveOM, share: curveShare, mix: curveMix, app: curveApp } };
  for (const [n, f] of Object.entries(methods)) {
    const bins = Array.from({ length: 10 }, () => ({ p: [], y: [] }));
    for (const r of test) { const p = f(r); const b = Math.min(9, Math.floor(p * 10)); bins[b].p.push(p); bins[b].y.push(y(r)); }
    res.methods[n] = {
      brier: mean(test.map((r) => (f(r) - y(r)) ** 2)),
      reliability: bins.map((b, i) => ({ bin: `${i * 10}-${i * 10 + 10}%`, n: b.p.length, said: mean(b.p), happened: mean(b.y) })).filter((b) => b.n),
      yesAt50: (() => { const said = test.filter((r) => f(r) >= 0.5); const hits = said.filter(y).length; const rained = test.filter(y).length; return { said: said.length, right: hits, caught: hits, of: rained }; })(),
      // per region, in plain counts: when it said rain (≥ 50 %) how often it rained; of the rain days, how many it warned
      byRegion: Object.fromEntries([...new Set(test.map((r) => r.region))].map((g) => { const t = test.filter((r) => r.region === g); const said = t.filter((r) => f(r) >= 0.5), wet = t.filter(y);
        return [g, { n: t.length, brier: mean(t.map((r) => (f(r) - y(r)) ** 2)), rainShare: mean(t.map(y)), said50: said.length, said50Rained: said.filter(y).length, rainDays: wet.length, warned50: wet.filter((r) => f(r) >= 0.5).length }]; })),
    };
  }
  // is each calibrated method clearly better than Open-Meteo's own %? (Brier, day-block bootstrap)
  res.boot = Object.fromEntries(Object.keys(methods).slice(1).map((n) => [n, bootDiff(test.map((r) => ({ day: r.day, a: (methods[n](r) - y(r)) ** 2, b: (methods["the app's % (proxy)"](r) - y(r)) ** 2 })), 1000, 7, week)]));
  // the bar also needs the best single source: each calibrated method vs Open-Meteo's own %; and no region
  // clearly made worse (each calibrated method vs the app's proxy % inside each region)
  const cal = Object.keys(methods).filter((n) => /calibrated/.test(n));
  res.bootVsOm = Object.fromEntries(cal.map((n) => [n, bootDiff(test.map((r) => ({ day: r.day, a: (methods[n](r) - y(r)) ** 2, b: (methods["Open-Meteo's own %"](r) - y(r)) ** 2 })), 1000, 7, week)]));
  res.regionGuard = Object.fromEntries([...new Set(test.map((r) => r.region))].map((g) => { const t = test.filter((r) => r.region === g);
    return [g, Object.fromEntries(cal.map((n) => [n, bootDiff(t.map((r) => ({ day: r.day, a: (methods[n](r) - y(r)) ** 2, b: (methods["the app's % (proxy)"](r) - y(r)) ** 2 })), 1000, 7, week)]))]; }));
  return res;
}

const out = { test: TEST, train: TRAIN, stations: RAIN_STATIONS.map((s) => s.id), today: evaluate(daysOut, 'rain today'), next3h: evaluate(windowsOut, 'rain in the next 3 hours') };
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'rain.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));
for (const r of [out.today, out.next3h]) {
  console.log(`\n== ${r.label.toUpperCase()} — TEST, n=${r.n}, it rained in ${(r.base * 100).toFixed(0)}%`);
  for (const [n, m] of Object.entries(r.methods)) {
    console.log(`${n.padEnd(30)} Brier ${m.brier.toFixed(4)}  | said ≥50%: ${m.yesAt50.said}, rained ${m.yesAt50.right} · caught ${m.yesAt50.caught}/${m.yesAt50.of}`);
    console.log('   ' + m.reliability.map((b) => `${b.bin}: said ${(b.said * 100).toFixed(0)} → rained ${(b.happened * 100).toFixed(0)} (n${b.n})`).join(' | '));
  }
  for (const [n, b] of Object.entries(r.boot)) console.log(`  ${n} vs the app's % (proxy): Brier ${b.diff.toFixed(4)} [${b.lo.toFixed(4)}, ${b.hi.toFixed(4)}]`);
  for (const [n, b] of Object.entries(r.bootVsOm)) console.log(`  ${n} vs Open-Meteo's own %: Brier ${b.diff.toFixed(4)} [${b.lo.toFixed(4)}, ${b.hi.toFixed(4)}]`);
  for (const [g, m] of Object.entries(r.regionGuard)) { const worse = Object.entries(m).filter(([, b]) => b && b.lo > 0).map(([n]) => n); if (worse.length) console.log(`  REGION WORSE ${g}: ${worse.join('; ')}`); }
  for (const [g, s] of Object.entries(r.methods["the app's % (proxy)"].byRegion)) console.log(`  ${g.padEnd(14)} app proxy: said rain ${s.said50}, rained ${s.said50Rained} · rain days ${s.rainDays}, warned ${s.warned50} | calibrated both: said ${r.methods['both, calibrated'].byRegion[g].said50}, rained ${r.methods['both, calibrated'].byRegion[g].said50Rained}, warned ${r.methods['both, calibrated'].byRegion[g].warned50}`);
}
