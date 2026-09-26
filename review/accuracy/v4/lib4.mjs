// Shared helpers for the v4 run (review/accuracy/v4/PLAN.md). Data lives in ../v2/data.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DATA, isNum } from '../v2/lib.mjs';
import { FOG_MODELS, fogFile } from './fetch4.mjs';

export const rhOf = (t, d) => (isNum(t) && isNum(d) ? 100 * Math.exp((17.625 * d) / (243.04 + d)) / Math.exp((17.625 * t) / (243.04 + t)) : null);

/** The short-lead archive of the five models for a station → Map<'YYYY-MM-DDTHH' (SAST), {model: {t, d, w, low, code, mm, vis, pp}}>. */
export function loadFog(id) {
  const out = new Map();
  const files = readdirSync(DATA).filter((f) => f.startsWith(`fog-${id}-`) && f.endsWith('.json'));
  for (const f of files) {
    const h = JSON.parse(readFileSync(path.join(DATA, f), 'utf8')).hourly;
    for (let i = 0; i < h.time.length; i++) {
      const row = {};
      for (const m of FOG_MODELS) {
        const g = (v) => h[`${v}_${m}`]?.[i];
        row[m] = { t: g('temperature_2m'), d: g('dew_point_2m'), w: g('wind_speed_10m'), low: g('cloud_cover_low'), code: g('weather_code'), mm: g('precipitation'), vis: g('visibility'), pp: g('precipitation_probability') };
      }
      out.set(h.time[i].slice(0, 13), row);
    }
  }
  return out;
}
export const hasFog = (id) => existsSync(path.join(DATA, fogFile(id, '2025-10-01')));

/**
 * Weekly-block bootstrap of the difference of a statistic computed on a whole list (ratios such as precision or
 * F0.5 are not means of items, so whole weeks are resampled and the statistic recomputed). stat(list) → number.
 */
export function bootStat(list, statA, statB, draws = 1000, seed = 7) {
  const byWeek = new Map();
  for (const x of list) (byWeek.get(x.week) || byWeek.set(x.week, []).get(x.week)).push(x);
  const weeks = [...byWeek.values()];
  if (!weeks.length) return null;
  const diff = (ws) => { const all = ws.flat(); const a = statA(all), b = statB(all); return isNum(a) && isNum(b) ? a - b : null; };
  const point = diff(weeks);
  let s = seed >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const reps = [];
  for (let k = 0; k < draws; k++) { const pick = []; for (let i = 0; i < weeks.length; i++) pick.push(weeks[Math.floor(rnd() * weeks.length)]); const v = diff(pick); if (isNum(v)) reps.push(v); }
  reps.sort((a, b) => a - b);
  return reps.length >= 0.9 * draws
    ? { diff: point, lo: reps[Math.floor(0.025 * reps.length)], hi: reps[Math.ceil(0.975 * reps.length) - 1], weeks: weeks.length }
    : { diff: point, lo: null, hi: null, weeks: weeks.length };
}

/** Wilson 95 % interval of k successes in n. */
export function wilson(k, n, z = 1.96) {
  if (!n) return { p: null, lo: null, hi: null };
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, lo: (c - r) / d, hi: (c + r) / d };
}
