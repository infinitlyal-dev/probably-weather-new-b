// Shared helpers for the rain / fog / frost run (review/accuracy/v3/PLAN.md). Data lives in ../v2/data.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DATA, isNum } from '../v2/lib.mjs';

/** Open-Meteo's own cloud, low cloud and dew point as forecast the day before (prev-<id>-best_match.json). */
export function loadPrev(id) {
  const file = path.join(DATA, `prev-${id}-best_match.json`);
  if (!existsSync(file)) return null;
  const h = JSON.parse(readFileSync(file, 'utf8')).hourly;
  const out = new Map();
  for (let i = 0; i < h.time.length; i++) {
    out.set(h.time[i].slice(0, 13), { cloud1: h.cloud_cover_previous_day1[i], dew1: h.dew_point_2m_previous_day1[i], low0: h.cloud_cover_low[i], low1: h.cloud_cover_low_previous_day1[i] });
  }
  return out;
}

/** Grid elevation Open-Meteo used for a station (the `elevation` its replies carry), from any saved reply. */
export function gridElevation(id, model = 'best_match') {
  for (const kind of ['runs', 'hist']) {
    const file = path.join(DATA, `${kind}-${id}-${model}.json`);
    if (existsSync(file)) { const e = JSON.parse(readFileSync(file, 'utf8')).elevation; if (isNum(e)) return e; }
  }
  return null;
}

/** The lowest broken / overcast / vertical-visibility layer in a raw METAR, in feet (null: none). */
export function ceilingFt(metar) {
  let low = null;
  for (const m of String(metar || '').matchAll(/\b(BKN|OVC|VV)(\d{3})\b/g)) { const ft = Number(m[2]) * 100; if (low === null || ft < low) low = ft; }
  return low;
}

/**
 * What the airport reported for the hour, for fog: 'fog' (visibility under 1 km, no precipitation), 'mist'
 * (1–5 km with BR), 'low-cloud' (a ceiling at 500 ft or lower, visibility ≥ 1 km), 'other', or null (no report
 * or the station reports no weather). Any report in the hour counts for fog, the chosen one for the rest.
 */
export function fogTruth(o, reportsWeather = true) {
  if (!o || !reportsWeather) return null;
  const reps = o.all?.length ? o.all : [o];
  const precip = reps.some((r) => r.precip);
  if (!precip && reps.some((r) => isNum(r.visKm) && r.visKm < 1)) return 'fog';
  if (!isNum(o.visKm)) return null;
  if (o.mist && o.visKm < 5) return 'mist';
  const c = ceilingFt(o.metar);
  if (c !== null && c <= 500) return 'low-cloud';
  return 'other';
}

/** ISO week number of a SAST date, and the alternating split: even weeks tune, odd weeks test. */
export function isoWeek(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;                 // Monday 0
  d.setUTCDate(d.getUTCDate() - dow + 3);              // the week's Thursday
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  return { year: y, week: 1 + Math.round(((d - jan4) / 86400e3 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7) };
}
export const weekKey = (day) => { const w = isoWeek(day); return `${w.year}-W${String(w.week).padStart(2, '0')}`; };
export const tuneWeek = (day) => isoWeek(day).week % 2 === 0;
