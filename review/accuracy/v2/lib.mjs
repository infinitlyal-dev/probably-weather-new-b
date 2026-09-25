// Shared loaders and statistics for the precision check (review/accuracy/v2/).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStationHourly } from '../lib/obs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA = path.join(here, 'data');
export const RESULTS = path.join(here, 'results');

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const mean = (a) => { const v = a.filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const round = (v, d = 2) => (isNum(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

// Tune on one period, prove on another (Al's rule): the model corrections and weights are learned
// on TRAIN only, every number reported for a change is on TEST.
export const TRAIN = { from: '2025-01-01', to: '2025-12-31' };
export const TEST = { from: '2026-01-01', to: '2026-09-24' };
export const inRange = (day, r) => day >= r.from && day <= r.to;

export const SEASON = (day) => { const m = Number(day.slice(5, 7)); return m === 12 || m <= 2 ? 'DJF' : m <= 5 ? 'MAM' : m <= 8 ? 'JJA' : 'SON'; };

/** METAR hourly records for a station, keyed 'YYYY-MM-DDTHH' in SAST. */
export function loadObs(id) {
  return loadStationHourly(path.join(DATA, `metar-${id}.csv`));
}

/** Previous-runs file → Map<'YYYY-MM-DDTHH', {t0,t1,p0,p1,w0,w1,cloud,dew,code}> (SAST). */
export function loadRuns(id, model) {
  const file = path.join(DATA, `runs-${id}-${model}.json`);
  if (!existsSync(file)) return null;
  const h = JSON.parse(readFileSync(file, 'utf8')).hourly;
  const out = new Map();
  for (let i = 0; i < h.time.length; i++) {
    out.set(h.time[i].slice(0, 13), {
      t0: h.temperature_2m[i], t1: h.temperature_2m_previous_day1[i],
      p0: h.precipitation[i], p1: h.precipitation_previous_day1[i],
      w0: h.wind_speed_10m[i], w1: h.wind_speed_10m_previous_day1[i],
      cloud: h.cloud_cover[i], dew: h.dew_point_2m[i], code: h.weather_code[i],
    });
  }
  return out;
}

/** Short-lead archive → Map<'YYYY-MM-DDTHH', {gust, vis, pp, code, cloud}>. */
export function loadHist(id, model) {
  const file = path.join(DATA, `hist-${id}-${model}.json`);
  if (!existsSync(file)) return null;
  const h = JSON.parse(readFileSync(file, 'utf8')).hourly;
  const out = new Map();
  for (let i = 0; i < h.time.length; i++) {
    out.set(h.time[i].slice(0, 13), { gust: h.wind_gusts_10m[i], vis: h.visibility[i], pp: h.precipitation_probability[i], code: h.weather_code[i], cloud: h.cloud_cover[i] });
  }
  return out;
}

export function days(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400e3) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
export const hourKey = (day, h) => `${day}T${String(h).padStart(2, '0')}`;

/**
 * Paired block bootstrap: 95 % interval of mean(a) − mean(b) over matched items, resampling whole blocks
 * (default a day; the temperature check passes 7-day weeks, because weather regimes last several days) so
 * every station on the same dates moves together. items: [{day, a, b}].
 */
export function bootDiff(items, draws = 1000, seed = 7, blockOf = (day) => day) {
  const byDay = new Map();
  for (const it of items) { if (!isNum(it.a) || !isNum(it.b)) continue; const k = blockOf(it.day); (byDay.get(k) || byDay.set(k, []).get(k)).push(it.a - it.b); }
  const blocks = [...byDay.values()];
  if (!blocks.length) return null;
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const stat = (bs) => { let sum = 0, n = 0; for (const b of bs) for (const v of b) { sum += v; n++; } return n ? sum / n : 0; };
  const point = stat(blocks);
  const reps = [];
  for (let k = 0; k < draws; k++) { const pick = []; for (let i = 0; i < blocks.length; i++) pick.push(blocks[Math.floor(rnd() * blocks.length)]); reps.push(stat(pick)); }
  reps.sort((x, y) => x - y);
  return { diff: point, lo: reps[Math.floor(0.025 * draws)], hi: reps[Math.ceil(0.975 * draws) - 1], days: blocks.length, n: items.length };
}

/** Pool-adjacent-violators isotonic fit: xs, ys (0/1 or values) → sorted breakpoints [[x, y]]. */
export function isotonic(xs, ys) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => isNum(x) && isNum(y)).sort((a, b) => a[0] - b[0]);
  const blocks = [];
  for (const [x, y] of pts) {
    blocks.push({ xlo: x, xhi: x, sum: y, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
      const b = blocks.pop(); const a = blocks[blocks.length - 1];
      a.xhi = b.xhi; a.sum += b.sum; a.n += b.n;
    }
  }
  return blocks.map((b) => [(b.xlo + b.xhi) / 2, b.sum / b.n, b.n]);
}
export function applyCurve(curve, x) {
  if (!curve?.length || !isNum(x)) return x;
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (x <= curve[i][0]) { const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1); }
  }
  return curve[curve.length - 1][1];
}
