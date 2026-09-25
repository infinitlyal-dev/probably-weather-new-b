// "The app now": production's high/low blend replayed on archived models (api/weather.js SOURCE_WEIGHTS,
// the ECMWF dedup, the MET boost off the Highveld, LOW_WEIGHTS — as in ../blend-vs-sources.mjs). Which model
// stands in for each real source cannot be known from archives (the first live day: Open-Meteo = ECMWF 9 km
// exactly, MET Norway close to it, Pirate Weather not GFS, WeatherAPI no single model), so three assignments
// are replayed and every conclusion must hold under all three.
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const BASE_WEIGHTS = [0.30, 0.22, 0.13, 0.20, 0.15];            // [OM, WA, PW, MET, TI]
export function productionWeights(highs, lat, lon) {
  const W = [...BASE_WEIGHTS]; let waDedup = 1;
  if (isNum(highs[0]) && isNum(highs[1]) && Math.abs(highs[0] - highs[1]) <= 0.5) { W[1] /= 2; waDedup = 0.5; }
  const isHighveld = lat > -28 && lon > 25;
  if (isNum(highs[3]) && !isHighveld) {
    const fam = [highs[0], highs[1]].filter(isNum);
    if (fam.length && highs[3] - fam.reduce((a, b) => a + b, 0) / fam.length > 5) { W[0] = 0.25; W[3] = 0.40; }
  }
  return { W, LOW: [BASE_WEIGHTS[0], BASE_WEIGHTS[1] * waDedup, BASE_WEIGHTS[2], 0, 0] };
}
const wavg = (vals, w) => { let s = 0, ws = 0; vals.forEach((v, i) => { if (isNum(v) && w[i] > 0) { s += v * w[i]; ws += w[i]; } }); return ws ? s / ws : null; };
export const VARIANTS = {
  'old harness': ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'],
  'ECMWF-heavy': ['best_match', 'ecmwf_ifs025', 'icon_seamless', 'best_match', 'best_match'],
  'mixed':       ['best_match', 'meteofrance_seamless', 'gfs_seamless', 'best_match', 'icon_seamless'],
};
// Production's windows: day 0 read at 06:00 — MET Norway and Tomorrow.io from now to midnight; day 1
// (the t1 lead, tomorrow as seen today) — MET Norway's whole day and no Tomorrow.io (day 0 only), so the
// weights renormalise over the other four.
export function appBlend(fc, slots, lat, lon, lead) {
  const s = slots.map((m) => fc[m]);
  const tomorrow = lead === 't1';
  const highs = [s[0]?.max, s[1]?.max, s[2]?.dayHigh, tomorrow ? s[3]?.max : s[3]?.fromNowMax, tomorrow ? null : s[4]?.fromNowMax];
  const lows = [s[0]?.min, s[1]?.min, s[2]?.min, tomorrow ? s[3]?.min : s[3]?.fromNowMin, tomorrow ? null : s[4]?.fromNowMin];
  const { W, LOW } = productionWeights(highs, lat, lon);
  return { max: wavg(highs, W), min: wavg(lows, LOW) };
}
