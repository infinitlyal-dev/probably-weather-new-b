// PRECISION (Al, 25 Sept 2026: "as close to right as possible"). Today's and tomorrow's high and low get
// a corrected consensus of five models as one more member of the existing blend.
//
// The consensus: best_match (Open-Meteo's own — ECMWF 9 km in SA — already in the main call) plus GFS,
// ICON, UK Met Office and Météo-France (one extra Open-Meteo request, temperature only). Each model's daily
// max / min has its own seasonal bias removed and the five are averaged with the weights in
// precision-table.js, learned at SA airports and proven on 2026 after learning on 2025
// (review/accuracy/v2/: PLAN.md, temps.mjs, results/).
//
// The mix: high = (1 − α) · the blend's high + α · the consensus high (same for the low), α from the
// table, capped at 0.5 until the live record earns more. Only days 0 and 1 (the leads the backtest proved),
// only inside South Africa and outside the Lowveld, only when all five models give the whole day; anything
// else leaves the blend exactly as it was. meta.precision records what happened, so the recorder can score
// it beside the blend.
import { PRECISION_TABLE } from './precision-table.js';

export const PRECISION_MODELS = ['gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
export const PRECISION_DAYS = 2;
const ALL = ['best_match', ...PRECISION_MODELS];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (v) => Math.round(v * 10) / 10;

/** South Africa's box (it also takes in Lesotho and Eswatini, whose weather is the same story). */
export function inSouthAfrica(lat, lon) {
  return isNum(lat) && isNum(lon) && lat >= -35.2 && lat <= -21.8 && lon >= 16.3 && lon <= 33.1;
}

/**
 * The Lowveld — Mpumalanga, Limpopo and Eswatini east of the escarpment — where the backtest found the mix
 * made the high and low worse (results/temps-t*.json, regionGuard): its nights run warmer than the models,
 * the reverse of the rest of SA, so the all-SA correction pushes them the wrong way. The plan's rule — a
 * region clearly made worse blocks the change there — keeps the app exactly as today here. North of
 * 24.4° S from 30.0° E (Tzaneen, Phalaborwa, Musina); south of it from 30.8° E (Mbombela, Barberton, the
 * Eswatini lowveld) down to 27° S.
 */
export function inLowveld(lat, lon) {
  return inSouthAfrica(lat, lon) && lat >= -27.0 && lon >= (lat > -24.4 ? 30.0 : 30.8);
}

export function seasonOf(isoDate) {
  const m = Number(String(isoDate).slice(5, 7));
  return m === 12 || m <= 2 ? 'DJF' : m <= 5 ? 'MAM' : m <= 8 ? 'JJA' : 'SON';
}

/** The extra Open-Meteo request: temperature for four models, 3 days from local midnight today. */
export function precisionUrl(host, lat, lon, keyParam = '') {
  return `${host}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&models=${PRECISION_MODELS.join(',')}&timezone=auto&forecast_days=3${keyParam}`;
}

/**
 * The corrected consensus for days 0 and 1.
 * @param {object} p
 * @param {number[]} p.bestMatch  the main call's hourly temperature_2m, index 0 = local midnight today
 * @param {object}   p.models     the extra response's `hourly` ({ time, temperature_2m_<model>: [...] }),
 *                                index 0 = local midnight today (timezone=auto, as the main call)
 * @param {object}   [p.table]    PRECISION_TABLE (injectable for tests)
 * @returns {Array<null | { date: string, high: number, low: number }>}  null for a day any model is
 *          missing an hour of
 */
export function precisionConsensus({ bestMatch, models, table = PRECISION_TABLE }) {
  const out = [];
  if (!Array.isArray(bestMatch) || !Array.isArray(models?.time)) return out;
  for (let d = 0; d < PRECISION_DAYS; d++) {
    const from = d * 24, to = from + 24;
    const date = String(models.time[from] || '').slice(0, 10);
    const tab = table.days?.[d];
    const series = { best_match: bestMatch.slice(from, to) };
    for (const m of PRECISION_MODELS) series[m] = (models[`temperature_2m_${m}`] || []).slice(from, to);
    if (!(date.length === 10 && tab && ALL.every((m) => series[m].length === 24 && series[m].every(isNum)))) { out.push(null); continue; }
    const season = seasonOf(date);
    const cons = (v) => {
      let s = 0, ws = 0;
      for (const m of ALL) {
        const x = v === 'max' ? Math.max(...series[m]) : Math.min(...series[m]);
        s += (x - tab[v].bias[m][season]) * tab[v].w[m]; ws += tab[v].w[m];
      }
      return s / ws;
    };
    out.push({ date, high: round1(cons('max')), low: round1(cons('min')) });
  }
  return out;
}

/**
 * One day's high and low: the blend's, or — when a consensus exists — the mix, kept honest with the
 * hourly strip beside it (the high never under that day's warmest strip hour, the low never over its
 * coolest; Fable, plan review item 7). With no consensus it returns the blend's figures unchanged.
 */
export function precisionMix({ blendHigh, blendLow, consensus, strip, alpha = PRECISION_TABLE.alpha }) {
  if (!consensus) return { highC: blendHigh, lowC: blendLow, applied: false };
  let highC = isNum(blendHigh) ? round1((1 - alpha) * blendHigh + alpha * consensus.high) : blendHigh;
  let lowC = isNum(blendLow) ? round1((1 - alpha) * blendLow + alpha * consensus.low) : blendLow;
  const v = (strip || []).filter(isNum);
  if (v.length) {
    if (isNum(highC)) highC = Math.max(highC, Math.max(...v));
    if (isNum(lowC)) lowC = Math.min(lowC, Math.min(...v));
  }
  return { highC, lowC, applied: true };
}
