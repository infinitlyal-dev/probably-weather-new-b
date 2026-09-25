// The high/low core shared by temps.mjs (the proof) and make-table.mjs (the table the app carries), so the
// shipped table is learned by exactly the code that was scored.
import { SCORED, RUN_MODELS, PERIOD } from './stations.mjs';
import { loadObs, loadRuns, days, hourKey, SEASON, isNum, mean } from './lib.mjs';

export const SEASONS = ['DJF', 'MAM', 'JJA', 'SON'];
// ECMWF once: best_match IS ECMWF 9 km for SA; ECMWF 0.25° is the same run coarser.
export const CONS = ['best_match', 'gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
export const KEY = { max: 'obsMax', min: 'obsMin' };
const DAY_ONLY = new Set(['FAEL']);
const maxOf = (a) => { const v = a.filter(isNum); return v.length ? Math.max(...v) : null; };
const minOf = (a) => { const v = a.filter(isNum); return v.length ? Math.min(...v) : null; };
export const H0 = 6; // the morning read, for the app-blend replay

/** Station-days with the observed max/min (coverage rules) and every model's forecast at `lead` (t0|t1). */
export function buildRows(lead) {
  const rows = [], stationsUsed = [];
  for (const st of SCORED) {
    const obs = loadObs(st.id);
    const runs = Object.fromEntries(RUN_MODELS.map((m) => [m, loadRuns(st.id, m)]).filter(([, v]) => v));
    if (Object.keys(runs).length < RUN_MODELS.length) continue;
    stationsUsed.push(st);
    for (const d of days(PERIOD.from, PERIOD.to)) {
      const T = []; const have = [];
      for (let h = 0; h < 24; h++) { const r = obs.get(hourKey(d, h)); if (r && isNum(r.tempC)) { T[h] = r.tempC; have.push(h); } }
      const dayOnly = DAY_ONLY.has(st.id);
      const hrs = dayOnly ? [...Array(13).keys()].map((i) => i + 7) : [...Array(24).keys()];
      if (!(dayOnly ? hrs.every((h) => isNum(T[h])) : have.length >= 20)) continue;
      const fc = {};
      for (const [m, R] of Object.entries(runs)) {
        const v = []; for (let h = 0; h < 24; h++) v[h] = R.get(hourKey(d, h))?.[lead];
        const sel = hrs.map((h) => v[h]);
        fc[m] = { max: maxOf(sel), min: dayOnly ? null : minOf(sel), dayHigh: maxOf(v.slice(7, 19)), fromNowMax: maxOf(v.slice(H0)), fromNowMin: minOf(v.slice(H0)) };
      }
      rows.push({ id: st.id, region: st.region, lat: st.lat, lon: st.lon, elev: st.elev, day: d, season: SEASON(d),
        obsMax: maxOf(hrs.map((h) => T[h])), obsMin: dayOnly ? null : minOf(hrs.map((h) => T[h])), fc });
    }
  }
  return { rows, stationsUsed };
}

/** Per model: bias by season (≥ 20 days, else 0) and an inverse-MSE weight, from the rows given. */
export function learn(fit, v) {
  const t = { bias: {}, w: {} };
  for (const m of CONS) {
    t.bias[m] = {};
    for (const s of SEASONS) { const e = fit.filter((r) => r.season === s && isNum(r[KEY[v]]) && isNum(r.fc[m][v])).map((r) => r.fc[m][v] - r[KEY[v]]); t.bias[m][s] = e.length >= 20 ? mean(e) : 0; }
    const e2 = fit.filter((r) => isNum(r[KEY[v]]) && isNum(r.fc[m][v])).map((r) => (r.fc[m][v] - t.bias[m][r.season] - r[KEY[v]]) ** 2);
    t.w[m] = e2.length ? 1 / mean(e2) : 0;
  }
  return t;
}

export function consensus(r, v, t) {
  let s = 0, ws = 0;
  for (const m of CONS) { const x = r.fc[m][v]; if (!isNum(x) || !t) continue; s += (x - t.bias[m][r.season]) * t.w[m]; ws += t.w[m]; }
  return ws ? s / ws : null;
}
