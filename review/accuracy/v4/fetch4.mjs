// The fog run's downloads (26 Sept 2026, review/accuracy/v4/PLAN.md): the short-lead archive (historical-forecast
// API — the first hours of each run, what "now" is read from) of the five models production can ask Open-Meteo
// for — best_match (production's Open-Meteo source; ECMWF 9 km in SA) and the precision request's four (GFS, ICON,
// UK Met Office, Météo-France) — at the 13 airports with fog truth, 1 Oct 2025 → 24 Sept 2026, split in two halves
// per station. Plus Strand for its two real fogs (21–22 May, 3 Aug 2026). Resumable; a reply that is not JSON is
// never saved (as v2/fetch.mjs).
//   node review/accuracy/v4/fetch4.mjs
import { existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCORED } from '../v2/stations.mjs';
import { DATA } from '../v2/lib.mjs';

export const FOG_MODELS = ['best_match', 'gfs_seamless', 'icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
export const FOG_VARS = ['temperature_2m', 'dew_point_2m', 'wind_speed_10m', 'cloud_cover_low', 'weather_code', 'precipitation', 'visibility', 'precipitation_probability'];
export const NO_TRUTH = new Set(['FALW', 'FAHS', 'FAWB']);   // no present weather, no usable visibility (v3)
export const FOG_STATIONS = SCORED.filter((s) => !NO_TRUTH.has(s.id));
export const STRAND = { id: 'STRAND', lat: -34.1163, lon: 18.8362 };
const HALVES = [['2025-10-01', '2026-03-31'], ['2026-04-01', '2026-09-24']];
const STRAND_WINDOWS = [['2026-05-21', '2026-05-22'], ['2026-08-03', '2026-08-03']];
export const fogFile = (id, from) => `fog-${id}-${from}.json`;

const PACE_MS = Number(process.env.PACE_MS || 20_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(DATA, 'fetch.log');
const log = (s) => { const l = `${new Date().toISOString()} ${s}`; console.log(l); appendFileSync(LOG, l + '\n'); };
const url = (s, from, to) => `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=${FOG_VARS.join(',')}&start_date=${from}&end_date=${to}&timezone=Africa%2FJohannesburg&models=${FOG_MODELS.join(',')}`;

const jobs = [];
for (const s of FOG_STATIONS) for (const [from, to] of HALVES) jobs.push({ file: fogFile(s.id, from), url: url(s, from, to) });
for (const [from, to] of STRAND_WINDOWS) jobs.push({ file: fogFile(STRAND.id, from), url: url(STRAND, from, to) });

async function get(u, file, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'probably-weather accuracy check (research, low volume)' }, signal: AbortSignal.timeout(240_000) });
      const body = await r.text();
      if (r.status === 429 || r.status >= 500) { log(`${file}: HTTP ${r.status}, waiting (try ${i}) ${body.slice(0, 120)}`); await sleep(60_000 * i); continue; }
      if (!r.ok) { log(`${file}: HTTP ${r.status} ${body.slice(0, 200)}`); return false; }
      try { JSON.parse(body); } catch { log(`${file}: not JSON (try ${i}) ${body.slice(0, 120)}`); await sleep(60_000 * i); continue; }
      writeFileSync(path.join(DATA, file), body);
      log(`${file}: ${Math.round(body.length / 1024)} KB`);
      return true;
    } catch (e) { log(`${file}: ${e.message} (try ${i})`); await sleep(15_000 * i); }
  }
  return false;
}

if (process.argv[1] && process.argv[1].endsWith('fetch4.mjs')) {
  mkdirSync(DATA, { recursive: true });
  const todo = jobs.filter((j) => !existsSync(path.join(DATA, j.file)));
  log(`v4 requests to do: ${todo.length} of ${jobs.length}`);
  for (const [i, j] of todo.entries()) { await get(j.url, j.file); if (i < todo.length - 1) await sleep(PACE_MS); }
  log('V4 DONE');
}
