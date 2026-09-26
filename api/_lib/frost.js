// FROST NIGHTS (Al, 26 Sept 2026: "frost night" — review/accuracy/v4/PLAN.md §4, results/v4-frost.json). On clear,
// calm nights inland the models' low runs warm: the air near the ground cools further than a model's lowest level.
// How much further, the coldest of the five models already hints at — so on a night Open-Meteo forecasts clear
// (mean cloud ≤ 40 %) and calm (mean wind ≤ 12 km/h), the displayed low moves toward that coldest model:
//
//   low − k × max(0, low − the coldest of the five models' own minimum for the day), at most 5 °C
//
// k learned on 2025 at the inland airports (0.60 for today's low, 0.58 for tomorrow's; stable 0.49–0.63 leaving each
// airport out) and proven on 2026 at those airports and at four SA Weather Service towns the tuning never saw:
// frost nights 2.3–3.1 → 1.7–2.0 °C off at the airports the day before, all nights better too, under all three
// source guesses. Only where it was proven: the regions below, 500 m up or higher, days 0 and 1, and only when the
// precision layer's five models are all there. North West and the Eastern Cape were blocked on 2025 (slightly worse
// there), the Lowveld and the coast were never in scope. Johannesburg's and Beaufort West's station cells are
// blocked too: Johannesburg airport got clearly worse on 2026 (1.1 → 1.35–1.43 °C off; Pretoria's gain hid it in the
// Highveld's number) and Beaufort West slightly (FROST_BLOCKED_CELLS, results stationsBlocked). Anything missing →
// the low exactly as before.
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (v) => Math.round(v * 10) / 10;
const mean = (a) => { const v = a.filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

export const FROST_REGIONS = ['Highveld', 'Free State', 'Northern Cape', 'Limpopo', 'Karoo', 'KZN inland'];
export const FROST_MIN_ELEVATION = 500;   // Open-Meteo's grid elevation, m
export const FROST_MAX_CLOUD = 40;        // % — the forecast night's mean cloud
export const FROST_MAX_WIND = 12;         // km/h — the forecast night's mean wind
export const FROST_K = [0.60, 0.58];      // day 0 (today's low), day 1 (tomorrow's)
export const FROST_MAX_DELTA = 5;         // °C
export const FROST_BLOCKED_CELLS = ['FAOR', '68727'];   // Johannesburg airport, Beaufort West (api/_lib/regions.js ids)
/** Why a frost step was not even considered here — nothing is recorded for these (meta.precision.frost stays empty). */
export const FROST_NOT_HERE = ['region', 'cell', 'elevation'];

/**
 * The forecast night the gate reads, as indices into Open-Meteo's hourly arrays (index 0 = local midnight today):
 * today's low 00:00 → 08:00; tomorrow's low 20:00 today → 08:00 tomorrow.
 */
export function frostNightHours(day) {
  return day === 0 ? [...Array(9).keys()] : [20, 21, 22, 23, ...[...Array(9).keys()].map((h) => 24 + h)];
}

/**
 * One day's low after the frost-night step.
 * @param {object} p
 * @param {number} p.day            0 or 1
 * @param {number} p.lowC           the day's low as it stands (after the precision mix)
 * @param {string|null} p.region    regionOf(lat, lon)
 * @param {string|null} p.cell      stationCellOf(lat, lon)
 * @param {number|null} p.elevation Open-Meteo's grid elevation
 * @param {number[]} p.clouds       Open-Meteo hourly cloud cover (%), index 0 = local midnight today
 * @param {number[]} p.winds        Open-Meteo hourly wind (km/h), same indexing
 * @param {number[]} p.bestMatch    Open-Meteo hourly temperature, same indexing
 * @param {object|null} p.models    the precision request's `hourly` (temperature_2m_<model>), same indexing
 * @param {string[]} p.modelNames   PRECISION_MODELS
 * @returns {{ lowC: number, applied: boolean, reason: string, cloud?: number, wind?: number, coldest?: number, deltaC?: number }}
 */
export function frostNightLow({ day, lowC, region, cell = null, elevation, clouds, winds, bestMatch, models, modelNames }) {
  const keep = (reason, extra = {}) => ({ lowC, applied: false, reason, ...extra });
  // where it does not apply at all first, so a missing low elsewhere records nothing (Fable, diff review 1)
  if (!FROST_REGIONS.includes(region)) return keep('region');
  if (FROST_BLOCKED_CELLS.includes(cell)) return keep('cell');
  if (!isNum(elevation) || elevation < FROST_MIN_ELEVATION) return keep('elevation');
  if (!(day === 0 || day === 1) || !isNum(lowC)) return keep('not-a-frost-day');
  const hrs = frostNightHours(day);
  const c = hrs.map((h) => clouds?.[h]).filter(isNum), w = hrs.map((h) => winds?.[h]).filter(isNum);
  // as the backtest: the night's mean needs most of its hours (13-hour night ≥ 10, 9-hour night ≥ 8; wind ≥ 8)
  if (c.length < (day === 0 ? 8 : 10) || w.length < 8) return keep('night-incomplete');
  const cloud = round1(mean(c)), wind = round1(mean(w));
  if (cloud > FROST_MAX_CLOUD || wind > FROST_MAX_WIND) return keep('not-clear-and-calm', { cloud, wind });
  const from = day * 24, to = from + 24;
  const series = [bestMatch, ...(modelNames || []).map((m) => models?.[`temperature_2m_${m}`])].map((s) => (Array.isArray(s) ? s.slice(from, to) : []));
  if (series.length !== 5 || !series.every((s) => s.length === 24 && s.every(isNum))) return keep('models-incomplete', { cloud, wind });
  const coldest = Math.min(...series.map((s) => Math.min(...s)));
  const deltaC = round1(Math.min(FROST_MAX_DELTA, FROST_K[day] * Math.max(0, lowC - coldest)));
  return { lowC: round1(lowC - deltaC), applied: deltaC > 0, reason: deltaC > 0 ? 'frost-night' : 'coldest-not-colder', cloud, wind, coldest: round1(coldest), deltaC };
}
